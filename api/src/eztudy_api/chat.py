"""Canonical UI transcript, referencing durable Ez runs; no execution queue."""
import base64
import binascii
from datetime import datetime, timezone
import hashlib
from uuid import UUID
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo import ReturnDocument
from starlette.concurrency import run_in_threadpool

from .auth import authenticated_user
from .database import account_for, database
from . import ez

router = APIRouter(prefix="/api/chat")
turns = database.chat_turns
TERMINAL = {"completed", "failed", "cancelled"}
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_BODY_BYTES = 4 * ((MAX_FILE_BYTES + 2) // 3) + 100_000
MAX_INBOX_PAGES = 10
MAX_INBOX_RUNS = 500
MAX_MESSAGES_PER_RUN = 200
MAX_MESSAGE_TEXT = 64_000
MAX_PROJECTED_MESSAGE_BYTES = 1_000_000


class Attachment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    data: str = Field(max_length=4 * ((MAX_FILE_BYTES + 2) // 3))

    def stored(self) -> dict:
        if "/" in self.name or "\\" in self.name or any(ord(character) < 32 for character in self.name):
            raise HTTPException(422, "Use a plain file name.")
        if self.name.rsplit(".", 1)[-1].lower() not in {"jpg", "jpeg", "png", "webp", "pdf", "txt", "md", "markdown"}:
            raise HTTPException(422, "Choose a JPEG, PNG, WebP, PDF, TXT or Markdown file.")
        try:
            data = base64.b64decode(self.data, validate=True)
        except (ValueError, binascii.Error) as error:
            raise HTTPException(422, "Invalid file upload.") from error
        if not data or len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, "Choose a nonempty file up to 10 MB.")
        return {"name": self.name, "data": data, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    text: str = Field(default="", max_length=16000)
    program_id: str | None = None
    item_id: str | None = None
    attachment: Attachment | None = None


def public(turn: dict) -> dict:
    messages = [{"id": message["id"], "text": message["text"]}
                for message in turn.get("messages", [])
                if isinstance(message, dict) and isinstance(message.get("id"), str) and isinstance(message.get("text"), str)]
    result = {key: turn[key] for key in ("request_id", "text", "status", "created_at")} | {
        "messages": messages, "item_id": turn.get("item_id")}
    if turn.get("attachment"):
        result["attachment"] = {key: turn["attachment"][key] for key in ("name", "size")}
    return result


def project_messages(turn: dict, messages: list) -> None:
    if not isinstance(messages, list) or len(messages) > MAX_MESSAGES_PER_RUN:
        raise HTTPException(502, "Ez returned too many messages.")
    existing = [{"id": message["id"], "text": message["text"]}
                for message in turn.get("messages", [])
                if isinstance(message, dict) and isinstance(message.get("id"), str) and isinstance(message.get("text"), str)]
    seen = {message["id"] for message in existing}
    projected = []
    total_bytes = sum(len(message["id"].encode()) + len(message["text"].encode()) for message in existing)
    for message in messages:
        if not isinstance(message, dict) or not isinstance(message.get("id"), str) or not isinstance(message.get("text"), str):
            raise HTTPException(502, "Ez returned an invalid message.")
        if len(message["id"]) > 200 or len(message["text"]) > MAX_MESSAGE_TEXT:
            raise HTTPException(502, "Ez returned an oversized message.")
        if message["id"] in seen:
            continue
        projection = {"id": message["id"], "text": message["text"]}
        total_bytes += len(projection["id"].encode()) + len(projection["text"].encode())
        if total_bytes > MAX_PROJECTED_MESSAGE_BYTES:
            raise HTTPException(502, "Ez returned an oversized message history.")
        seen.add(projection["id"])
        projected.append(projection)
    for message in projected:
        # Only a new receipt brings an older conversation back into the visible page.
        turns.update_one({"_id": turn["_id"], "messages.id": {"$ne": message["id"]}}, {
            "$addToSet": {"messages": message},
            "$set": {"activity_at": datetime.now(timezone.utc).isoformat()},
        })


def inbox_runs(page: dict) -> list[dict]:
    runs = page.get("runs")
    if not isinstance(runs, list):
        raise HTTPException(502, "Ez returned an invalid inbox.")
    for snapshot in runs:
        if not isinstance(snapshot, dict) or not isinstance(snapshot.get("id"), str):
            raise HTTPException(502, "Ez returned an invalid inbox run.")
        if len(snapshot["id"]) > 200 or not isinstance(snapshot.get("messages"), list):
            raise HTTPException(502, "Ez returned an invalid inbox run.")
        origin = snapshot.get("originRunId")
        if origin is not None and (not isinstance(origin, str) or len(origin) > 200):
            raise HTTPException(502, "Ez returned an invalid inbox run.")
    return runs


def reconcile(account: dict, turn: dict) -> dict:
    if turn["status"] in TERMINAL or not turn.get("run_id"):
        return turn
    binding = ez.binding_for(account["id"])
    if turn.get("binding_id") != binding["bindingId"]:
        raise HTTPException(409, "This message belongs to an earlier Ez binding.")
    snapshot = ez.call(binding, f'/v1/runs/{turn["run_id"]}')
    # Concurrent older polls must not overwrite a terminal result.
    turns.update_one({"_id": turn["_id"], "status": {"$nin": list(TERMINAL)}}, {"$set": {"status": snapshot["status"]}})
    project_messages(turn, snapshot["messages"])
    return turns.find_one({"_id": turn["_id"]})


@router.get("")
def history(response: Response, subject: str = Depends(authenticated_user), program_id: str | None = None):
    response.headers["Cache-Control"] = "no-store"
    account = account_for(subject)
    if account.get('selected_program_id') != program_id:
        raise HTTPException(409, 'Program selection changed; refresh your learning space.')
    sync_error = None
    try:
        binding = ez.binding_for(account["id"])
        # Project Ez's inbox, including native scheduled replies. No app scheduling.
        page = ez.call(binding, "/v1/runs")
        snapshots = inbox_runs(page)
        if len(snapshots) > MAX_INBOX_RUNS:
            raise HTTPException(502, "Ez returned an oversized inbox.")
        seen = set()
        pages = 1
        while cursor := page.get("nextCursor"):
            if not isinstance(cursor, str) or len(cursor) > 500:
                raise HTTPException(502, "Ez returned an invalid inbox cursor.")
            if pages >= MAX_INBOX_PAGES:
                raise HTTPException(502, "Ez inbox pagination limit reached.")
            if cursor in seen:
                raise HTTPException(502, "Ez returned an invalid inbox cursor.")
            seen.add(cursor)
            page = ez.call(binding, "/v1/runs?before=" + quote(cursor, safe=""))
            page_runs = inbox_runs(page)
            if len(page_runs) + len(snapshots) > MAX_INBOX_RUNS:
                raise HTTPException(502, "Ez returned an oversized inbox.")
            snapshots = page_runs + snapshots
            pages += 1
        origins = [snapshot.get("originRunId", snapshot["id"]) for snapshot in snapshots]
        by_run = {turn["run_id"]: turn for turn in turns.find({"tenant_id": account["tenant_id"], "binding_id": binding["bindingId"], "run_id": {"$in": origins}}, {"attachment.data": 0})}
        for snapshot in snapshots:
            turn = by_run.get(snapshot.get("originRunId", snapshot["id"]))
            if not turn:
                continue
            if snapshot["id"] == turn["run_id"]:
                turns.update_one({"_id": turn["_id"], "status": {"$nin": list(TERMINAL)}}, {"$set": {"status": snapshot["status"]}})
            project_messages(turn, snapshot["messages"])
    except HTTPException as error:
        sync_error = error.detail
    records = list(turns.find({"tenant_id": account["tenant_id"], "program_id": program_id}, {"attachment.data": 0}).sort([("activity_at", -1), ("created_at", -1)]).limit(100))
    return {"turns": [public(turn) for turn in reversed(records)], "sync_error": sync_error}


@router.post("", status_code=202)
async def upload(request: Request, subject: str = Depends(authenticated_user)):
    # Authentication runs before the body is consumed; chunked bodies are bounded too.
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            raise HTTPException(413, "Choose one file up to 10 MB.")
        body.extend(chunk)
    try:
        message = Message.model_validate_json(bytes(body))
    except ValidationError as error:
        raise HTTPException(422, "Invalid message or attachment.") from error
    return await run_in_threadpool(submit, message, subject)


def submit(message: Message, subject: str = Depends(authenticated_user)):
    attachment = message.attachment.stored() if message.attachment else None
    if not message.text.strip() and not attachment:
        raise HTTPException(422, "Write a message or attach a file first.")
    account = account_for(subject)
    binding = ez.binding_for(account["id"])
    program_id = account.get('selected_program_id')
    if message.program_id != program_id:
        raise HTTPException(409, 'Program selection changed; refresh before sending.')
    if program_id:
        program = database.programs.find_one({'_id': account['tenant_id'] + ':' + program_id})
        if not program or (message.item_id and not any(item['id'] == message.item_id for item in program['program']['items'])):
            raise HTTPException(404, 'Program or Item not found.')
    elif message.item_id:
        raise HTTPException(422, 'An Item requires a selected Program.')
    request_id = str(message.request_id)
    key = f'{account["tenant_id"]}:{request_id}'
    turn = turns.find_one_and_update({"_id": key}, {"$setOnInsert": {
        "tenant_id": account["tenant_id"], "request_id": request_id,
        **({"attachment": attachment} if attachment else {}),
        "text": message.text, "status": "submitting", "messages": [],
        "binding_id": binding["bindingId"], "program_id": program_id, "item_id": message.item_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "activity_at": datetime.now(timezone.utc).isoformat(),
    }}, upsert=True, return_document=ReturnDocument.AFTER)
    if turn.get("attachment") != attachment or turn.get("program_id") != program_id or turn.get("item_id") != message.item_id or turn["text"] != message.text or turn.get("binding_id", binding["bindingId"]) != binding["bindingId"]:
        raise HTTPException(409, "This request already contains a different message or binding.")
    if turn["status"] not in TERMINAL:
        if "binding_id" not in turn:
            raise HTTPException(409, "Check this earlier submission in Ez before retrying.")
        if not turn.get("run_id"):
            scope = hashlib.sha256(f'{account["tenant_id"]}:{account["id"]}:{program_id}'.encode()).hexdigest() if program_id else account['id']
            admission = {"requestId": request_id, "scope": scope, "text": turn["text"], "followOwner": program_id is None}
            if program_id:
                admission['context'] = {'programId': program_id, **({'itemId': message.item_id} if message.item_id else {})}
            if attachment:
                admission["attachment"] = {"name": attachment["name"], "data": base64.b64encode(attachment["data"]).decode("ascii")}
            try:
                snapshot = ez.call(binding, "/v1/runs", admission)
            except HTTPException as error:
                if error.status_code == 422:
                    turns.update_one({"_id": key, "status": "submitting"}, {"$set": {"status": "failed"}})
                raise
            turns.update_one({"_id": key}, {"$set": {"run_id": snapshot["id"]}})
            turn["run_id"] = snapshot["id"]
        turn = reconcile(account, turn)
    return public(turn)


def owned_turn(subject: str, request_id: UUID):
    account = account_for(subject)
    turn = turns.find_one({"_id": f'{account["tenant_id"]}:{request_id}'})
    if not turn:
        raise HTTPException(404, "Message not found.")
    return account, turn


@router.get("/{request_id}")
def status(request_id: UUID, response: Response, subject: str = Depends(authenticated_user)):
    response.headers["Cache-Control"] = "no-store"
    account, turn = owned_turn(subject, request_id)
    return public(reconcile(account, turn))


@router.post("/{request_id}/cancel")
def cancel(request_id: UUID, subject: str = Depends(authenticated_user)):
    account, turn = owned_turn(subject, request_id)
    if not turn.get("run_id"):
        raise HTTPException(409, "Check the submission outcome before cancelling.")
    if turn["status"] not in TERMINAL:
        binding = ez.binding_for(account["id"])
        if turn.get("binding_id") != binding["bindingId"]:
            raise HTTPException(409, "This message belongs to an earlier Ez binding.")
        ez.call(binding, f'/v1/runs/{turn["run_id"]}/cancel', {})
    return public(reconcile(account, turn))


@router.post("/{request_id}/retry", status_code=202)
def retry(request_id: UUID, subject: str = Depends(authenticated_user)):
    _, turn = owned_turn(subject, request_id)
    attachment = turn.get("attachment")
    return submit(Message(
        request_id=request_id,
        text=turn["text"],
        program_id=turn.get("program_id"),
        item_id=turn.get("item_id"),
        attachment=Attachment(name=attachment["name"], data=base64.b64encode(attachment["data"]).decode("ascii")) if attachment else None,
    ), subject)


@router.get("/{request_id}/attachment")
def download(request_id: UUID, subject: str = Depends(authenticated_user)):
    _, turn = owned_turn(subject, request_id)
    attachment = turn.get("attachment")
    if not attachment:
        raise HTTPException(404, "Attachment not found.")
    return Response(bytes(attachment["data"]), media_type="application/octet-stream", headers={
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(attachment["name"], safe=""),
    })

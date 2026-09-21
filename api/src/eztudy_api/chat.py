"""Thin transport over durable Ez runs: admission plus live readback. No app store."""
import base64
import binascii
import hashlib
import re
from uuid import UUID
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from .auth import authenticated_user
from .database import account_for, database
from . import ez

router = APIRouter(prefix="/api/chat")
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_BODY_BYTES = 4 * ((MAX_FILE_BYTES + 2) // 3) + 100_000
MAX_INBOX_PAGES = 10
MAX_INBOX_RUNS = 500
MAX_MESSAGES_PER_RUN = 200
MAX_MESSAGE_TEXT = 64_000
MAX_PROJECTED_MESSAGE_BYTES = 1_000_000
RUN_ID = re.compile(r"[A-Za-z0-9_-]{1,200}\Z")


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


def scope_for(account: dict, program_id: str | None) -> str:
    """Deterministic app scope so Ez readback filters without a local record."""
    if not program_id:
        return account["id"]
    return hashlib.sha256(f'{account["tenant_id"]}:{account["id"]}:{program_id}'.encode()).hexdigest()


def messages_of(snapshot: dict) -> list[dict]:
    """Project only validated message ids and text from one Ez run snapshot."""
    messages = snapshot.get("messages", [])
    if not isinstance(messages, list) or len(messages) > MAX_MESSAGES_PER_RUN:
        raise HTTPException(502, "Ez returned too many messages.")
    projected, seen, total_bytes = [], set(), 0
    for message in messages:
        if not isinstance(message, dict) or not isinstance(message.get("id"), str) or not isinstance(message.get("text"), str):
            raise HTTPException(502, "Ez returned an invalid message.")
        if not message["id"] or len(message["id"]) > 200 or len(message["text"]) > MAX_MESSAGE_TEXT:
            raise HTTPException(502, "Ez returned an oversized message.")
        if message["id"] in seen:
            continue
        total_bytes += len(message["id"].encode()) + len(message["text"].encode())
        if total_bytes > MAX_PROJECTED_MESSAGE_BYTES:
            raise HTTPException(502, "Ez returned an oversized message history.")
        seen.add(message["id"])
        projected.append({"id": message["id"], "text": message["text"]})
    return projected


def public_turn(run_id: str, snapshot: dict) -> dict:
    status = snapshot.get("status")
    if not isinstance(status, str):
        raise HTTPException(502, "Ez returned an invalid run status.")
    return {"run_id": run_id, "status": status, "messages": messages_of(snapshot)}


def checked_run_id(run_id: str) -> str:
    if not RUN_ID.fullmatch(run_id):
        raise HTTPException(404, "Chat request not found.")
    return quote(run_id, safe="")


def read_run(binding: dict, run_id: str) -> dict:
    return ez.call(binding, "/v1/runs/" + checked_run_id(run_id))


def inbox_runs(page: dict) -> list[dict]:
    runs = page.get("runs")
    if not isinstance(runs, list):
        raise HTTPException(502, "Ez returned an invalid inbox.")
    for snapshot in runs:
        if not isinstance(snapshot, dict) or not isinstance(snapshot.get("id"), str):
            raise HTTPException(502, "Ez returned an invalid inbox run.")
        if len(snapshot["id"]) > 200:
            raise HTTPException(502, "Ez returned an invalid inbox run.")
        origin = snapshot.get("originRunId")
        if origin is not None and (not isinstance(origin, str) or len(origin) > 200):
            raise HTTPException(502, "Ez returned an invalid inbox run.")
    return runs


def inbox(binding: dict) -> list[dict]:
    page = ez.call(binding, "/v1/runs")
    snapshots = inbox_runs(page)
    if len(snapshots) > MAX_INBOX_RUNS:
        raise HTTPException(502, "Ez returned an oversized inbox.")
    seen, pages = set(), 1
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
    return snapshots


@router.get("")
def history(response: Response, subject: str = Depends(authenticated_user), program_id: str | None = None):
    response.headers["Cache-Control"] = "no-store"
    account = account_for(subject)
    if account.get('selected_program_id') != program_id:
        raise HTTPException(409, 'Program selection changed; refresh your learning space.')
    sync_error = None
    turns: list[dict] = []
    try:
        binding = ez.binding_for(account["id"])
        scope = scope_for(account, program_id)
        grouped: dict[str, dict] = {}
        for snapshot in inbox(binding):
            if snapshot.get("scope") != scope:
                continue
            if not isinstance(snapshot.get("status"), str):
                raise HTTPException(502, "Ez returned an invalid run status.")
            key = snapshot.get("originRunId") or snapshot["id"]
            # Scheduled runs read back under the run that originated them.
            turn = grouped.setdefault(key, {"run_id": key, "status": "completed", "messages": []})
            if snapshot["id"] == key:
                turn["status"] = snapshot["status"]
            for message in messages_of(snapshot):
                if message not in turn["messages"]:
                    turn["messages"].append(message)
        turns = list(grouped.values())
    except HTTPException as error:
        sync_error = error.detail
    return {"turns": turns, "sync_error": sync_error}


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
    """Thin admission: untouched text, slim scope, idempotent Ez request key."""
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
    admission = {"requestId": str(message.request_id), "scope": scope_for(account, program_id),
                 "text": message.text, "followOwner": program_id is None}
    if program_id:
        admission['context'] = {'programId': program_id, **({'itemId': message.item_id} if message.item_id else {})}
    if attachment:
        admission["attachment"] = {"name": attachment["name"], "data": base64.b64encode(attachment["data"]).decode("ascii")}
    snapshot = ez.call(binding, "/v1/runs", admission)
    if not isinstance(snapshot.get("id"), str):
        raise HTTPException(502, "Ez returned an invalid run receipt.")
    return public_turn(snapshot["id"], snapshot)


@router.get("/{run_id}")
def status(run_id: str, response: Response, subject: str = Depends(authenticated_user)):
    response.headers["Cache-Control"] = "no-store"
    account = account_for(subject)
    binding = ez.binding_for(account["id"])
    return public_turn(run_id, read_run(binding, run_id))


@router.post("/{run_id}/cancel")
def cancel(run_id: str, subject: str = Depends(authenticated_user)):
    account = account_for(subject)
    binding = ez.binding_for(account["id"])
    ez.call(binding, "/v1/runs/" + checked_run_id(run_id) + "/cancel", {})
    return public_turn(run_id, read_run(binding, run_id))

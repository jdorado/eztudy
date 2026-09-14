"""Authorized publication and canonical selection. No agent execution."""
import hashlib
from datetime import datetime, timezone

from bson import BSON
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool

from .auth import authenticated_user
from .database import account_for, accounts, database
from eztudy_publishing.schema import validate, revision

router = APIRouter(prefix='/api/content')
programs = database.programs
credentials = database.publication_credentials
MAX_PUBLICATION_BODY_BYTES = 2_000_000
MAX_SELECTION_BODY_BYTES = 4_096


class Publication(BaseModel):
    model_config = ConfigDict(extra='forbid')
    program: dict
    expected_revision: str | None = None


class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    program_id: str = Field(min_length=1, max_length=200)


def publisher(authorization: str = Header(default='')):
    if not authorization.startswith('Bearer '):
        raise HTTPException(401, 'A publishing credential is required.')
    digest = hashlib.sha256(authorization[7:].encode()).hexdigest()
    grant = credentials.find_one({'_id': digest, 'revoked': False})
    if not grant or not accounts.find_one({'id': grant['account_id'], 'tenant_id': grant['tenant_id']}):
        raise HTTPException(401, 'Invalid publishing credential.')
    return grant


def authorized_program(grant, program_id):
    if 'content:publish' not in grant.get('scopes', []) or program_id not in grant.get('program_ids', []):
        raise HTTPException(403, 'This credential cannot publish that Program.')


def checked(payload, grant):
    try:
        program = validate(payload.program)
    except (ValueError, TypeError) as error:
        raise HTTPException(422, str(error)) from error
    authorized_program(grant, program['id'])
    return program


def check(payload: Publication, grant=Depends(publisher)):
    program = checked(payload, grant)
    return {'valid': True, 'program_id': program['id'], 'revision': revision(program), 'items': len(program['items'])}


def publish(payload: Publication, grant=Depends(publisher)):
    program = checked(payload, grant)
    digest = revision(program)
    key = grant['tenant_id'] + ':' + program['id']
    existing = programs.find_one({'_id': key})
    if existing and existing['revision'] == digest:
        return existing['receipt'] | {'unchanged': True}
    if (existing['revision'] if existing else None) != payload.expected_revision:
        raise HTTPException(409, 'Published revision changed. Inspect the current source/receipt before publishing.')
    receipt = {'id': hashlib.sha256((key + ':' + digest).encode()).hexdigest(),
               'program_id': program['id'], 'revision': digest,
               'published_at': datetime.now(timezone.utc).isoformat()}
    version = {'program': program, 'receipt': receipt}
    record = {'_id': key, 'tenant_id': grant['tenant_id'], 'account_id': grant['account_id'],
              'generation': (existing.get('generation', 0) if existing else 0) + 1,
              'program_id': program['id'], 'revision': digest, 'program': program, 'receipt': receipt,
              'versions': (existing['versions'] if existing else []) + [version]}
    if len(BSON.encode(record)) > 12_000_000:
        raise HTTPException(422, 'Publication history capacity reached; no content was changed.')
    try:
        if existing:
            result = programs.replace_one({'_id': key, 'revision': payload.expected_revision, 'generation': existing.get('generation')}, record)
            if result.modified_count != 1:
                current = programs.find_one({'_id': key})
                if current and current['revision'] == digest:
                    return current['receipt'] | {'unchanged': True}
                raise HTTPException(409, 'Concurrent publication; no content was changed.')
        else:
            programs.insert_one(record)
    except DuplicateKeyError:
        current = programs.find_one({'_id': key})
        if current and current['revision'] == digest:
            return current['receipt'] | {'unchanged': True}
        raise HTTPException(409, 'Concurrent publication; no content was changed.')
    # Only a first publication selects automatically. Existing selection is preserved.
    accounts.update_one({
        'id': grant['account_id'],
        '$or': [{'selected_program_id': None}, {'selected_program_id': {'$exists': False}}],
    }, {'$set': {'selected_program_id': program['id']}})
    return receipt | {'unchanged': False}


async def publication_from(request: Request) -> Publication:
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_PUBLICATION_BODY_BYTES:
            raise HTTPException(413, 'Publication request is too large.')
        body.extend(chunk)
    try:
        return Publication.model_validate_json(bytes(body))
    except ValidationError as error:
        raise HTTPException(422, 'Invalid publication request.') from error


async def selection_from(request: Request) -> Selection:
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_SELECTION_BODY_BYTES:
            raise HTTPException(413, 'Program selection request is too large.')
        body.extend(chunk)
    try:
        return Selection.model_validate_json(bytes(body))
    except ValidationError as error:
        raise HTTPException(422, 'Invalid Program selection request.') from error


@router.post('/check')
async def check_route(request: Request, grant=Depends(publisher)):
    payload = await publication_from(request)
    return await run_in_threadpool(check, payload, grant)


@router.post('/publish')
async def publish_route(request: Request, grant=Depends(publisher)):
    payload = await publication_from(request)
    return await run_in_threadpool(publish, payload, grant)


def view(account):
    records = list(programs.find({'tenant_id': account['tenant_id']}, {'program': 1, 'receipt': 1}).sort('program_id', 1))
    return {'programs': [record['program'] for record in records],
            'selected_program_id': account.get('selected_program_id'),
            'receipts': [record['receipt'] for record in records]}


@router.get('')
def read(response: Response, subject: str = Depends(authenticated_user)):
    response.headers['Cache-Control'] = 'no-store'
    return view(account_for(subject))


def select(selection: Selection, subject: str):
    account = account_for(subject)
    if not programs.find_one({'_id': account['tenant_id'] + ':' + selection.program_id}):
        raise HTTPException(404, 'Program not found.')
    accounts.update_one({'id': account['id']}, {'$set': {'selected_program_id': selection.program_id}})
    return view(account_for(subject))


@router.post('/selection')
async def select_route(request: Request, subject: str = Depends(authenticated_user)):
    selection = await selection_from(request)
    return await run_in_threadpool(select, selection, subject)

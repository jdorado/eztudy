"""Canonical MongoDB account/tenant mapping, atomic on verified Privy subject."""
import os
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

MONGO_URL = os.environ.get("MONGO_URL", "").strip()
MONGO_DATABASE = os.environ.get("MONGO_DATABASE", "").strip()
if not MONGO_URL or not MONGO_DATABASE:
    raise RuntimeError("Configure MONGO_URL and MONGO_DATABASE before starting the API.")

client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=8000)
database = client[MONGO_DATABASE]
accounts = database.accounts


def initialize() -> None:
    database.command("ping")
    allowed = allowed_subjects()
    for account in accounts.find({}, {"_id": True}):
        if account["_id"] not in allowed:
            raise RuntimeError("An existing account is absent from EZTUDY_ALLOWED_SUBJECTS.")
    # The old one-owner index must be removed before a second approved subject
    # signs in. Existing records retain their legacy singleton field harmlessly.
    if "singleton_1" in accounts.index_information():
        accounts.drop_index("singleton_1")
    accounts.create_index("tenant_id", unique=True)


def allowed_subjects() -> set[str]:
    raw = os.environ.get("EZTUDY_ALLOWED_SUBJECTS")
    if raw is None:
        raw = os.environ.get("EZTUDY_ALLOWED_SUBJECT", "")
    subjects = [part.strip() for part in raw.split(",") if part.strip()]
    if len(subjects) != len(set(subjects)) or any(
        not re.fullmatch(r"did:privy:[A-Za-z0-9_-]+", subject) for subject in subjects
    ):
        raise RuntimeError("Configure unique Privy subjects in EZTUDY_ALLOWED_SUBJECTS.")
    return set(subjects)


def account_for(subject: str) -> dict:
    if subject not in allowed_subjects():
        raise HTTPException(403, "This Eztudy installation is invite-only.")
    existing = accounts.find_one({"_id": subject}, {"_id": False})
    if existing:
        return existing
    # _id is the unique Privy subject: concurrent first-sign-in retries reuse one mapping.
    try:
        return accounts.find_one_and_update(
            {"_id": subject},
            {"$setOnInsert": {
                "id": str(uuid4()),
                "tenant_id": str(uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            projection={"_id": False},
        )
    except DuplicateKeyError as error:
        raise HTTPException(409, "Account creation conflicted; retry sign-in.") from error

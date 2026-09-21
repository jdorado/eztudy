"""Canonical MongoDB account/tenant mapping, atomic on verified Privy subject."""
import os
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
    account_count = accounts.count_documents({}, limit=2)
    if account_count > 1:
        raise RuntimeError("Eztudy 0.1 supports exactly one canonical account.")
    allowed_subject = os.environ.get("EZTUDY_ALLOWED_SUBJECT", "").strip()
    if "," in allowed_subject:
        raise RuntimeError("EZTUDY_ALLOWED_SUBJECT accepts exactly one Privy subject.")
    if account_count == 1:
        owner = accounts.find_one({}, {"_id": True})
        if allowed_subject and owner and owner["_id"] != allowed_subject:
            raise RuntimeError("EZTUDY_ALLOWED_SUBJECT does not match the canonical account.")
        accounts.update_one({"_id": owner["_id"]}, {"$set": {"singleton": "owner"}})
    # This database-enforced slot prevents a configuration change or concurrent
    # admission from ever creating a second canonical account.
    accounts.create_index("singleton", unique=True)
    accounts.create_index("tenant_id", unique=True)


def account_for(subject: str) -> dict:
    existing = accounts.find_one({"_id": subject}, {"_id": False})
    if existing:
        return existing
    allowed_subject = os.environ.get("EZTUDY_ALLOWED_SUBJECT", "").strip()
    if subject != allowed_subject:
        raise HTTPException(403, "This Eztudy installation is invite-only.")
    # _id is the unique Privy subject: concurrent first-sign-in retries reuse one mapping.
    try:
        return accounts.find_one_and_update(
            {"_id": subject},
            {"$setOnInsert": {
                "singleton": "owner",
                "id": str(uuid4()),
                "tenant_id": str(uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            projection={"_id": False},
        )
    except DuplicateKeyError as error:
        raise HTTPException(403, "This Eztudy installation already has an owner.") from error

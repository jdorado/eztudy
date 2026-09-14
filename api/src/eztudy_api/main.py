from contextlib import asynccontextmanager
import os
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth import authenticated_user
from .database import account_for, client, database, initialize
from .chat import router as chat_router
from .content import router as content_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize()
    try:
        yield
    finally:
        client.close()


def configured_cors_origins(value: str) -> list[str]:
    origins = []
    for candidate in value.split(","):
        origin = candidate.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlparse(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password \
                or parsed.path or parsed.params or parsed.query or parsed.fragment:
            raise RuntimeError("EZTUDY_CORS_ORIGINS must contain exact HTTP(S) origins.")
        origins.append(origin)
    return origins


app = FastAPI(title="Eztudy API", version="0.1.1", lifespan=lifespan)
cors_origins = configured_cors_origins(os.environ.get("EZTUDY_CORS_ORIGINS", ""))
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
app.include_router(chat_router)
app.include_router(content_router)


class Account(BaseModel):
    id: str
    tenant_id: str
    created_at: str


@app.get("/api/health")
def health():
    database.command("ping")
    return {"status": "ok"}


@app.post("/api/account", response_model=Account)
def ensure_account(response: Response, subject: str = Depends(authenticated_user)):
    response.headers["Cache-Control"] = "no-store"
    return account_for(subject)

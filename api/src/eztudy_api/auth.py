"""Verify Privy access tokens; browser identity claims never establish authority."""
import os
import re

import jwt
from fastapi import Header, HTTPException

APP_ID = os.environ.get("PRIVY_APP_ID", "").strip()
if not re.fullmatch(r"[a-zA-Z0-9_-]+", APP_ID):
    raise RuntimeError("Configure PRIVY_APP_ID before starting the API.")

# Public signing keys: this authentication slice needs no Privy app secret.
keys = jwt.PyJWKClient(
    f"https://auth.privy.io/api/v1/apps/{APP_ID}/jwks.json", timeout=8
)


def verify_token(token: str) -> str:
    payload = jwt.decode(
        token,
        keys.get_signing_key_from_jwt(token).key,
        algorithms=["ES256"],
        audience=APP_ID,
        issuer="privy.io",
        options={"require": ["exp", "iat", "sub", "aud", "iss"]},
    )
    subject = payload["sub"]
    if not isinstance(subject, str) or not subject.startswith("did:privy:"):
        raise jwt.InvalidTokenError("Invalid subject")
    return subject


def authenticated_user(authorization: str | None = Header(default=None)) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(401, "Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    try:
        return verify_token(token.strip())
    except jwt.PyJWKClientConnectionError as error:
        raise HTTPException(503, "Sign-in verification is temporarily unavailable.") from error
    except jwt.PyJWTError as error:
        raise HTTPException(401, "Your sign-in has expired or is invalid.", headers={"WWW-Authenticate": "Bearer"}) from error

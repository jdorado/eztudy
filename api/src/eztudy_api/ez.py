"""Authenticated HTTP transport to Ez. No model, session or execution loop here."""
import json
import os
from pathlib import Path
import stat
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, HTTPRedirectHandler, build_opener

from fastapi import HTTPException


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HTTPError(req.full_url, code, "Ez redirects are forbidden", headers, fp)


transport = build_opener(NoRedirect)
MAX_EZ_RESPONSE_BYTES = 2_000_000


def read_private_text(value: str) -> str:
    path = Path(value)
    if not path.is_absolute() or path.is_symlink():
        raise ValueError("Secret files must be absolute regular files")
    details = path.stat()
    if not stat.S_ISREG(details.st_mode) or details.st_uid != os.geteuid() or details.st_mode & 0o077:
        raise ValueError("Secret files must be owner-only and owned by the API process")
    return path.read_text()


def binding_for(account_id: str) -> dict:
    path = os.environ.get("EZ_BINDINGS_FILE", "")
    if not path:
        raise HTTPException(503, "Chat is not connected yet.")
    try:
        registry = json.loads(read_private_text(path))
        if registry.get("version") != 1 or not isinstance(registry.get("bindings"), list):
            raise ValueError("Invalid binding registry")
        principals, endpoints = set(), set()
        for entry in registry["bindings"]:
            endpoint = urlparse(entry["url"])
            origin = (endpoint.scheme, endpoint.hostname, endpoint.port or (443 if endpoint.scheme == "https" else 80))
            if entry["principalId"] in principals or origin in endpoints or not Path(entry["tokenFile"]).is_absolute():
                raise ValueError("Each owner requires its own installation")
            principals.add(entry["principalId"])
            endpoints.add(origin)
        binding = next(item for item in registry["bindings"] if item["principalId"] == account_id and not item.get("revoked"))
        parsed = urlparse(binding["url"])
        local_http = parsed.scheme == "http" and (
            parsed.hostname in {"127.0.0.1", "localhost"}
            or (parsed.hostname == "relay" and parsed.port in {None, 8787})
        )
        if parsed.scheme != "https" and not local_http:
            raise ValueError("Use HTTPS or a local private endpoint")
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
            raise ValueError("Invalid endpoint")
        registration = call(binding, "/v1/registration")
        if registration.get("ownerId") != binding.get("ownerId", account_id) or not isinstance(registration.get("bindingId"), str):
            raise ValueError("Ez registration does not match the authenticated owner")
        return {**binding, "bindingId": registration["bindingId"]}
    except (OSError, ValueError, KeyError, StopIteration, TypeError) as error:
        raise HTTPException(503, "Chat is not connected for this account.") from error


def call(binding: dict, path: str, body: dict | None = None) -> dict:
    try:
        token = read_private_text(binding["tokenFile"]).strip()
        request = Request(binding["url"].rstrip("/") + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        with transport.open(request, timeout=10) as response:
            raw = response.read(MAX_EZ_RESPONSE_BYTES + 1)
            if len(raw) > MAX_EZ_RESPONSE_BYTES:
                raise ValueError("Ez response is too large")
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError("Ez response must be an object")
            return result
    except HTTPError as error:
        if error.code == 400:
            try:
                rejected = json.loads(error.read(65_537))
            except (ValueError, OSError):
                rejected = {}
            if rejected.get("admitted") is False:
                raise HTTPException(422, "Ez rejected this file or message. Choose a supported file and send a new message.") from error
        if error.code == 404:
            raise HTTPException(404, "Chat request not found in Ez.") from error
        if error.code == 409:
            raise HTTPException(409, "This request already contains a different message.") from error
        raise HTTPException(502, "Ez could not accept this request. Retry the same message.") from error
    except (OSError, URLError, ValueError) as error:
        raise HTTPException(503, "Ez is unavailable. Retry the same message to check its outcome.") from error

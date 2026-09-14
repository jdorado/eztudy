import unittest
import json
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request

from eztudy_api.ez import NoRedirect
from eztudy_api import ez
from fastapi import HTTPException


class TransportTests(unittest.TestCase):
    def test_binding_is_verified_by_ez_registration(self):
        registry = {"version": 1, "bindings": [{"principalId": "account", "url": "http://localhost:8788", "tokenFile": "/private/token"}]}
        with patch.dict("os.environ", {"EZ_BINDINGS_FILE": "/private/bindings"}), \
             patch.object(ez, "read_private_text", return_value=json.dumps(registry)), \
             patch.object(ez, "call", return_value={"ownerId": "account", "bindingId": "registered"}) as call:
            self.assertEqual(ez.binding_for("account")["bindingId"], "registered")
            self.assertEqual(call.call_args.args[1], "/v1/registration")
            call.return_value = {"ownerId": "different-owner", "bindingId": "registered"}
            with self.assertRaises(HTTPException) as failure:
                ez.binding_for("account")
            self.assertEqual(failure.exception.status_code, 503)

    def test_compose_relay_is_the_only_non_loopback_http_endpoint(self):
        for url, accepted in (
            ("http://relay:8787", True),
            ("http://relay", True),
            ("http://relay:8788", False),
            ("http://other-service:8787", False),
        ):
            registry = {"version": 1, "bindings": [{
                "principalId": "account", "url": url, "tokenFile": "/private/token"}]}
            with self.subTest(url=url), \
                 patch.dict("os.environ", {"EZ_BINDINGS_FILE": "/private/bindings"}), \
                 patch.object(ez, "read_private_text", return_value=json.dumps(registry)), \
                 patch.object(ez, "call", return_value={"ownerId": "account", "bindingId": "registered"}):
                if accepted:
                    self.assertEqual(ez.binding_for("account")["bindingId"], "registered")
                else:
                    with self.assertRaises(HTTPException) as failure:
                        ez.binding_for("account")
                    self.assertEqual(failure.exception.status_code, 503)

    def test_existing_telegram_owner_requires_explicit_server_mapping(self):
        registry = {"version": 1, "bindings": [{"principalId": "account", "ownerId": "telegram:42:42", "url": "http://localhost:8788", "tokenFile": "/private/token"}]}
        with patch.dict("os.environ", {"EZ_BINDINGS_FILE": "/private/bindings"}), \
             patch.object(ez, "read_private_text", return_value=json.dumps(registry)), \
             patch.object(ez, "call", return_value={"ownerId": "telegram:42:42", "bindingId": "registered"}):
            self.assertEqual(ez.binding_for("account")["bindingId"], "registered")
            with self.assertRaises(HTTPException):
                ez.binding_for("unmapped-account")

    def test_redirects_never_forward_credentials(self):
        request = Request("https://ez.example/v1/runs", headers={"Authorization": "Bearer test"})
        for code in (301, 302, 303, 307, 308):
            with self.subTest(code=code), self.assertRaises(HTTPError):
                NoRedirect().redirect_request(request, None, code, "redirect", {}, "https://elsewhere.example/")

    def test_explicit_ez_rejection_becomes_recoverable_upload_error(self):
        body = json.dumps({"admitted": False}).encode()
        rejected = HTTPError("http://localhost/v1/runs", 400, "bad request", {}, BytesIO(body))
        with patch.object(ez.transport, "open", side_effect=rejected), \
             patch.object(ez, "read_private_text", return_value="token"), \
             self.assertRaises(HTTPException) as failure:
            ez.call({"url": "http://localhost", "tokenFile": "/private/token"}, "/v1/runs", {})
        self.assertEqual(failure.exception.status_code, 422)

    def test_secret_files_reject_symlinks_wrong_owners_and_broad_modes(self):
        with patch("pathlib.Path.is_absolute", return_value=True), \
             patch("pathlib.Path.is_symlink", return_value=True), \
             self.assertRaises(ValueError):
            ez.read_private_text("/private/token")

        details = type("Details", (), {"st_mode": 0o100600, "st_uid": 123})()
        with patch("pathlib.Path.is_absolute", return_value=True), \
             patch("pathlib.Path.is_symlink", return_value=False), \
             patch("pathlib.Path.stat", return_value=details), \
             patch("os.geteuid", return_value=456), \
             self.assertRaises(ValueError):
            ez.read_private_text("/private/token")

        details.st_uid = 456
        details.st_mode = 0o100644
        with patch("pathlib.Path.is_absolute", return_value=True), \
             patch("pathlib.Path.is_symlink", return_value=False), \
             patch("pathlib.Path.stat", return_value=details), \
             patch("os.geteuid", return_value=456), \
             self.assertRaises(ValueError):
            ez.read_private_text("/private/token")

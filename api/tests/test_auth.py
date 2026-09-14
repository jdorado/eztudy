"""Focused token-boundary checks; no test identity reaches MongoDB."""
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

from eztudy_api import auth


class TokenBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.claims = {
            "sub": "did:privy:test-only", "iss": "privy.io", "aud": auth.APP_ID,
            "iat": int(time.time()), "exp": int(time.time()) + 60,
        }
        self.verifier = patch.object(auth.keys, "get_signing_key_from_jwt", return_value=SimpleNamespace(key=self.key.public_key()))
        self.verifier.start()
        self.addCleanup(self.verifier.stop)

    def test_valid_token_returns_verified_subject(self):
        token = jwt.encode(self.claims, self.key, algorithm="ES256")
        self.assertEqual(auth.verify_token(token), self.claims["sub"])

    def test_wrong_audience_issuer_and_expiry_are_rejected(self):
        for changed in ({"aud": "another-app"}, {"iss": "another-issuer"}, {"exp": 1}):
            with self.subTest(changed=changed):
                token = jwt.encode(self.claims | changed, self.key, algorithm="ES256")
                with self.assertRaises(HTTPException) as error:
                    auth.authenticated_user(f"Bearer {token}")
                self.assertEqual(error.exception.status_code, 401)

    def test_wrong_signature_is_rejected(self):
        other_key = ec.generate_private_key(ec.SECP256R1())
        token = jwt.encode(self.claims, other_key, algorithm="ES256")
        with self.assertRaises(HTTPException) as error:
            auth.authenticated_user(f"Bearer {token}")
        self.assertEqual(error.exception.status_code, 401)

    def test_missing_or_malformed_credentials_are_rejected(self):
        for header in (None, "Basic something", "Bearer ", "Bearer invalid"):
            with self.subTest(header=header), self.assertRaises(HTTPException) as error:
                auth.authenticated_user(header)
            self.assertEqual(error.exception.status_code, 401)

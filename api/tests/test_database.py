import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from eztudy_api import database


class AccountAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.store = MagicMock()
        self.store.index_information.return_value = {"singleton_1": {}, "tenant_id_1": {}}
        self.patcher = patch.object(database, "accounts", self.store)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_existing_account_is_available_when_allowlisted(self):
        self.store.find_one.return_value = {"id": "account", "tenant_id": "tenant"}
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECTS": "did:privy:owner"}):
            self.assertEqual(database.account_for("did:privy:owner")["tenant_id"], "tenant")
        self.store.find_one_and_update.assert_not_called()

    def test_unknown_account_is_rejected_while_registration_is_closed(self):
        self.store.find_one.return_value = None
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECTS": "did:privy:owner"}):
            with self.assertRaises(HTTPException) as raised:
                database.account_for("did:privy:unknown")
        self.assertEqual(raised.exception.status_code, 403)
        self.store.find_one_and_update.assert_not_called()

    def test_two_allowlisted_subjects_can_create_separate_accounts(self):
        self.store.find_one.return_value = None
        self.store.find_one_and_update.side_effect = [
            {"id": "account", "tenant_id": "tenant"},
            {"id": "girls", "tenant_id": "girls-tenant"},
        ]
        settings = {"EZTUDY_ALLOWED_SUBJECTS": "did:privy:owner,did:privy:girls"}
        with patch.dict(os.environ, settings):
            self.assertEqual(database.account_for("did:privy:owner")["id"], "account")
            self.assertEqual(database.account_for("did:privy:girls")["id"], "girls")
        writes = self.store.find_one_and_update.call_args_list
        self.assertEqual([call.args[0]["_id"] for call in writes],
                         ["did:privy:owner", "did:privy:girls"])
        self.assertNotIn("singleton", writes[0].args[1]["$setOnInsert"])

    def test_unlisted_existing_subject_is_rejected(self):
        self.store.find_one.return_value = {"id": "girls", "tenant_id": "girls-tenant"}
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECTS": "did:privy:owner"}):
            with self.assertRaises(HTTPException) as raised:
                database.account_for("did:privy:girls")
        self.assertEqual(raised.exception.status_code, 403)
        self.store.find_one.assert_not_called()

    def test_initialize_rejects_unlisted_existing_account(self):
        self.store.find.return_value = [{"_id": "did:privy:owner"}, {"_id": "did:privy:girls"}]
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECTS": "did:privy:owner"}), \
             patch.object(database.database, "command"):
            with self.assertRaises(RuntimeError):
                database.initialize()
        self.store.drop_index.assert_not_called()

    def test_initialize_drops_legacy_singleton_index(self):
        self.store.find.return_value = [{"_id": "did:privy:owner"}]
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECTS": "did:privy:owner,did:privy:girls"}), \
             patch.object(database.database, "command"):
            database.initialize()
        self.store.drop_index.assert_called_once_with("singleton_1")
        self.store.create_index.assert_called_once_with("tenant_id", unique=True)

    def test_legacy_single_subject_setting_remains_supported(self):
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECT": "did:privy:owner"}, clear=True):
            self.assertEqual(database.allowed_subjects(), {"did:privy:owner"})

    def test_rejects_duplicate_or_invalid_subjects(self):
        for value in ("did:privy:owner,did:privy:owner", "someone@example.com"):
            with self.subTest(value=value), patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECTS": value}):
                with self.assertRaises(RuntimeError):
                    database.allowed_subjects()


if __name__ == "__main__":
    unittest.main()

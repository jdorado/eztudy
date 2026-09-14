import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from eztudy_api import database


class AccountAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.store = MagicMock()
        self.patcher = patch.object(database, "accounts", self.store)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_existing_account_is_available_while_registration_is_closed(self):
        self.store.find_one.return_value = {"id": "account", "tenant_id": "tenant"}
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECT": ""}):
            self.assertEqual(database.account_for("did:privy:owner")["tenant_id"], "tenant")
        self.store.find_one_and_update.assert_not_called()

    def test_unknown_account_is_rejected_while_registration_is_closed(self):
        self.store.find_one.return_value = None
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECT": ""}):
            with self.assertRaises(HTTPException) as raised:
                database.account_for("did:privy:unknown")
        self.assertEqual(raised.exception.status_code, 403)
        self.store.find_one_and_update.assert_not_called()

    def test_allowlisted_subject_can_create_the_single_account(self):
        self.store.find_one.return_value = None
        self.store.find_one_and_update.return_value = {"id": "account", "tenant_id": "tenant"}
        settings = {"EZTUDY_ALLOWED_SUBJECT": "did:privy:owner"}
        with patch.dict(os.environ, settings):
            self.assertEqual(database.account_for("did:privy:owner")["id"], "account")
        self.assertTrue(self.store.find_one_and_update.called)
        inserted = self.store.find_one_and_update.call_args.args[1]["$setOnInsert"]
        self.assertEqual(inserted["singleton"], "owner")

    def test_second_subject_is_rejected_by_database_singleton(self):
        self.store.find_one.return_value = None
        self.store.find_one_and_update.side_effect = database.DuplicateKeyError("singleton")
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECT": "did:privy:new-owner"}):
            with self.assertRaises(HTTPException) as raised:
                database.account_for("did:privy:new-owner")
        self.assertEqual(raised.exception.status_code, 403)

    def test_initialize_rejects_more_than_one_canonical_account(self):
        self.store.count_documents.return_value = 2
        with patch.object(database.database, "command"):
            with self.assertRaises(RuntimeError):
                database.initialize()
        self.store.create_index.assert_not_called()

    def test_initialize_rejects_changed_allowlisted_subject(self):
        self.store.count_documents.return_value = 1
        self.store.find_one.return_value = {"_id": "did:privy:owner"}
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECT": "did:privy:mistyped"}), \
             patch.object(database.database, "command"):
            with self.assertRaises(RuntimeError):
                database.initialize()
        self.store.create_index.assert_not_called()

    def test_initialize_backfills_and_indexes_singleton_slot(self):
        self.store.count_documents.return_value = 1
        self.store.find_one.return_value = {"_id": "did:privy:owner"}
        with patch.dict(os.environ, {"EZTUDY_ALLOWED_SUBJECT": "did:privy:owner"}), \
             patch.object(database.database, "command"), \
             patch.object(database.database, "chat_turns"):
            database.initialize()
        self.store.update_one.assert_called_once_with(
            {"_id": "did:privy:owner"}, {"$set": {"singleton": "owner"}})
        self.store.create_index.assert_any_call("singleton", unique=True)


if __name__ == "__main__":
    unittest.main()

"""Focused app-boundary checks. No test records are written to MongoDB."""
import base64
import unittest
from unittest.mock import ANY, MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException, Response

from eztudy_api import chat


class ChatBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.account = {"id": "test-account", "tenant_id": "test-tenant"}
        self.store = MagicMock()
        for target, value in (("account_for", lambda _: self.account), ("turns", self.store)):
            mock = patch.object(chat, target, value)
            mock.start()
            self.addCleanup(mock.stop)

    def test_reads_and_cancellation_require_owned_turn(self):
        request_id = uuid4()
        self.store.find_one.return_value = None
        with patch.object(chat.ez, "call") as transport:
            for method in (chat.cancel, chat.retry, chat.download):
                with self.assertRaises(HTTPException) as error:
                    method(request_id, "verified-subject")
                self.assertEqual(error.exception.status_code, 404)
            self.store.find_one.assert_called_with({"_id": f"test-tenant:{request_id}"})
            transport.assert_not_called()

    def test_literal_input_and_same_request_key_are_forwarded(self):
        request_id = uuid4()
        text = "  Explain this\nwithout changing my text.  "
        def persist(query, update, **kwargs):
            return {"_id": query["_id"], **update["$setOnInsert"]}
        self.store.find_one_and_update.side_effect = persist
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", return_value={"id": "ez-returned-id"}) as transport, \
             patch.object(chat, "reconcile", side_effect=lambda _, turn: turn):
            message = chat.Message(request_id=request_id, text=text)
            chat.submit(message, "verified-subject")
            chat.submit(message, "verified-subject")
            expected = {"requestId": str(request_id), "scope": "test-account", "text": text, "followOwner": True}
            self.assertEqual([call.args[2] for call in transport.call_args_list], [expected, expected])
            self.store.update_one.assert_called_with(
                {"_id": f"test-tenant:{request_id}"}, {"$set": {"run_id": "ez-returned-id"}})

    def test_admitted_retry_reads_existing_run_without_resubmitting(self):
        turn = {"_id": "saved", "request_id": str(uuid4()), "text": "original",
                "status": "running", "messages": [], "created_at": "now",
                "run_id": "ez-returned-id", "binding_id": "test-binding"}
        self.store.find_one_and_update.return_value = turn
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call") as transport, \
             patch.object(chat, "reconcile", return_value=turn):
            chat.submit(chat.Message(request_id=turn["request_id"], text="original"), "verified-subject")
            transport.assert_not_called()

    def test_earlier_binding_is_not_read_or_cancelled_through_current_installation(self):
        turn = {"_id": "saved", "request_id": str(uuid4()), "text": "original",
                "status": "running", "messages": [], "created_at": "now",
                "run_id": "possibly-colliding-run", "binding_id": "old-binding"}
        self.store.find_one.return_value = turn
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "current-binding"}), \
             patch.object(chat.ez, "call") as transport:
            with self.assertRaises(HTTPException) as read_error:
                chat.reconcile(self.account, turn)
            self.assertEqual(read_error.exception.status_code, 409)
            with self.assertRaises(HTTPException) as cancel_error:
                chat.cancel(turn["request_id"], "verified-subject")
            self.assertEqual(cancel_error.exception.status_code, 409)
            transport.assert_not_called()

    def test_transport_failure_retries_original_request(self):
        turn = {"_id": "saved", "request_id": str(uuid4()), "text": "original",
                "status": "submitting", "messages": [], "created_at": "now",
                "binding_id": "test-binding"}
        self.store.find_one_and_update.return_value = turn
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", side_effect=[HTTPException(503), {"id": "returned"}]) as transport, \
             patch.object(chat, "reconcile", side_effect=lambda _, value: value):
            message = chat.Message(request_id=turn["request_id"], text=turn["text"])
            with self.assertRaises(HTTPException):
                chat.submit(message, "verified-subject")
            self.assertNotIn("run_id", turn)
            chat.submit(message, "verified-subject")
            self.assertEqual(transport.call_args_list[0], transport.call_args_list[1])
            self.assertEqual(turn["run_id"], "returned")

    def test_conflicting_retry_never_reaches_ez(self):
        self.store.find_one_and_update.return_value = {"text": "original", "run_id": "original"}
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call") as transport:
            with self.assertRaises(HTTPException) as error:
                chat.submit(chat.Message(request_id=uuid4(), text="changed"), "verified-subject")
            self.assertEqual(error.exception.status_code, 409)
            transport.assert_not_called()

    def test_inbox_projects_paginated_scheduled_receipts_only_to_owned_origin(self):
        turn = {"_id": "saved", "request_id": str(uuid4()), "text": "original", "status": "completed",
                "messages": [], "created_at": "now", "run_id": "own-run", "binding_id": "test-binding"}
        self.store.find.return_value.sort.return_value.limit.return_value = [turn]
        self.store.find.return_value.__iter__.return_value = [turn]
        reply = {"id": "receipt", "text": "Native scheduled reply"}
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", side_effect=[
                 {"runs": [{"id": "scheduled", "originRunId": "own-run", "messages": [reply]}], "nextCursor": "older"},
                 {"runs": [{"id": "foreign", "originRunId": "other-tenant", "messages": [{"id": "private", "text": "hidden"}]}], "nextCursor": None},
             ]) as transport:
            result = chat.history(Response(), "verified-subject")
            self.assertIsNone(result["sync_error"])
            self.assertEqual([call.args[1] for call in transport.call_args_list], ["/v1/runs", "/v1/runs?before=older"])
            self.store.find.assert_any_call({"tenant_id": "test-tenant", "binding_id": "test-binding", "run_id": {"$in": ["other-tenant", "own-run"]}}, {"attachment.data": 0})
            self.store.update_one.assert_called_once_with({"_id": "saved", "messages.id": {"$ne": "receipt"}}, {"$addToSet": {"messages": reply}, "$set": {"activity_at": ANY}})

    def test_invalid_or_oversized_ez_messages_are_not_persisted(self):
        turn = {"_id": "saved"}
        for messages in (
            [{"id": "reply", "text": "x"}] * (chat.MAX_MESSAGES_PER_RUN + 1),
            [{"id": "reply", "text": "x" * (chat.MAX_MESSAGE_TEXT + 1)}],
            [{"id": "reply"}],
        ):
            with self.subTest(size=len(messages)), self.assertRaises(HTTPException):
                chat.project_messages(turn, messages)
        self.store.update_one.assert_not_called()

    def test_ez_message_projection_discards_private_fields(self):
        turn = {"_id": "saved", "messages": []}
        chat.project_messages(turn, [{"id": "reply", "text": "safe", "actorPrivate": "secret", "tool": {"token": "hidden"}}])
        persisted = self.store.update_one.call_args.args[1]["$addToSet"]["messages"]
        self.assertEqual(persisted, {"id": "reply", "text": "safe"})
        public = chat.public({"request_id": "r", "text": "q", "status": "completed", "created_at": "now",
                              "messages": [{"id": "reply", "text": "safe", "actorPrivate": "secret"}]})
        self.assertEqual(public["messages"], [{"id": "reply", "text": "safe"}])

    def test_ez_message_projection_caps_aggregate_bytes(self):
        turn = {"_id": "saved", "messages": [{"id": "old", "text": "x" * (chat.MAX_PROJECTED_MESSAGE_BYTES - 3)}]}
        with self.assertRaises(HTTPException) as raised:
            chat.project_messages(turn, [{"id": "new", "text": "x"}])
        self.assertEqual(raised.exception.status_code, 502)
        self.store.update_one.assert_not_called()

    def test_invalid_inbox_run_shape_is_rejected(self):
        for page in ({}, {"runs": "not-a-list"}, {"runs": [{"id": "run", "messages": "not-a-list"}]}):
            with self.subTest(page=page), self.assertRaises(HTTPException):
                chat.inbox_runs(page)

    def test_attachment_preserves_program_and_item_scope(self):
        self.account["selected_program_id"] = "program-one"
        data = b"attachment QA: lunar compass"
        attachment = chat.Attachment(name="note.md", data=base64.b64encode(data).decode())
        self.store.find_one_and_update.side_effect = lambda query, update, **kwargs: {"_id": query["_id"], **update["$setOnInsert"]}
        program = {"program": {"items": [{"id": "item-one"}]}}
        with patch.object(chat, "database") as database, \
             patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", return_value={"id": "run"}) as transport, \
             patch.object(chat, "reconcile", side_effect=lambda _, turn: turn):
            database.programs.find_one.return_value = program
            result = chat.submit(chat.Message(request_id=uuid4(), text="  Read this exactly.  ", program_id="program-one", item_id="item-one", attachment=attachment), "verified")
        admission = transport.call_args.args[2]
        self.assertFalse(admission["followOwner"])
        self.assertEqual(admission["context"], {"programId": "program-one", "itemId": "item-one"})
        self.assertEqual(admission["attachment"], attachment.model_dump())
        self.assertEqual(result["attachment"], {"name": "note.md", "size": len(data)})
        self.assertNotIn("data", result["attachment"])

    def test_invalid_attachments_are_rejected_before_storage_or_ez(self):
        cases = (("evil.exe", b"plain"), ("../note.txt", b"plain"), ("empty.txt", b""))
        with patch.object(chat.ez, "binding_for") as binding:
            for name, data in cases:
                with self.subTest(name=name), self.assertRaises(HTTPException):
                    chat.submit(chat.Message(request_id=uuid4(), attachment={"name": name, "data": base64.b64encode(data).decode()}), "verified")
            with self.assertRaises(HTTPException):
                chat.Attachment(name="bad.txt", data="***").stored()
            self.store.find_one_and_update.assert_not_called()
            binding.assert_not_called()

"""Focused app-boundary checks. No test records are written to MongoDB."""
import base64
import hashlib
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException, Response

from eztudy_api import chat

RUN = "r_app_" + "a" * 64


class ChatBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.account = {"id": "test-account", "tenant_id": "test-tenant"}
        self.account_patch = patch.object(chat, "account_for", lambda _: self.account)
        self.account_patch.start()
        self.addCleanup(self.account_patch.stop)

    def test_literal_input_and_deterministic_scope_reach_ez_without_a_store(self):
        request_id = uuid4()
        text = "  Explain this\nwithout changing my text.  "
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", return_value={"id": RUN, "status": "queued", "messages": []}) as transport:
            result = chat.submit(chat.Message(request_id=request_id, text=text), "verified-subject")
        self.assertEqual(transport.call_args.args[2], {
            "requestId": str(request_id), "scope": "test-account", "text": text, "followOwner": True})
        self.assertEqual(result, {"run_id": RUN, "status": "queued", "messages": []})

    def test_program_scope_context_and_item_validation(self):
        self.account["selected_program_id"] = "program-one"
        program = {"program": {"items": [{"id": "item-one"}]}}
        with patch.object(chat, "database") as database, \
             patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", return_value={"id": RUN, "status": "running", "messages": []}) as transport:
            database.programs.find_one.return_value = program
            chat.submit(chat.Message(request_id=uuid4(), text="Read this", program_id="program-one", item_id="item-one"), "verified")
        admission = transport.call_args.args[2]
        self.assertEqual(admission["scope"], hashlib.sha256(b"test-tenant:test-account:program-one").hexdigest())
        self.assertFalse(admission["followOwner"])
        self.assertEqual(admission["context"], {"programId": "program-one", "itemId": "item-one"})

    def test_selection_change_fails_before_ez(self):
        self.account["selected_program_id"] = "program-two"
        with patch.object(chat.ez, "binding_for") as binding:
            with self.assertRaises(HTTPException) as error:
                chat.submit(chat.Message(request_id=uuid4(), text="hi", program_id="program-one"), "verified")
            self.assertEqual(error.exception.status_code, 409)
            binding.assert_not_called()

    def test_item_without_program_is_rejected(self):
        with patch.object(chat.ez, "binding_for") as binding:
            with self.assertRaises(HTTPException) as error:
                chat.submit(chat.Message(request_id=uuid4(), text="hi", item_id="item-one"), "verified")
            self.assertEqual(error.exception.status_code, 422)
            binding.assert_not_called()

    def test_attachment_is_forwarded_and_never_stored(self):
        attachment = chat.Attachment(name="note.md", data=base64.b64encode(b"attachment QA").decode())
        with patch.object(chat, "database"), \
             patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", return_value={"id": RUN, "status": "queued", "messages": []}) as transport:
            result = chat.submit(chat.Message(request_id=uuid4(), text="", attachment=attachment), "verified")
        self.assertEqual(transport.call_args.args[2]["attachment"], attachment.model_dump())
        self.assertNotIn("attachment", result)

    def test_invalid_attachments_are_rejected_before_ez(self):
        cases = (("evil.exe", b"plain"), ("../note.txt", b"plain"), ("empty.txt", b""))
        with patch.object(chat.ez, "binding_for") as binding:
            for name, data in cases:
                with self.subTest(name=name), self.assertRaises(HTTPException):
                    chat.submit(chat.Message(request_id=uuid4(), attachment={"name": name, "data": base64.b64encode(data).decode()}), "verified")
            with self.assertRaises(HTTPException):
                chat.Attachment(name="bad.txt", data="***").stored()
            binding.assert_not_called()

    def test_history_projects_only_owned_scope_and_groups_scheduled_replies(self):
        own = {"id": RUN, "scope": "test-account", "status": "running", "messages": [{"id": "m1", "text": "reply"}]}
        scheduled = {"id": "r_schedule_" + "b" * 64, "originRunId": RUN, "scope": "test-account", "status": "completed",
                     "messages": [{"id": "m2", "text": "scheduled reply"}]}
        foreign = {"id": "r_app_" + "c" * 64, "scope": "other-account", "status": "completed",
                   "messages": [{"id": "private", "text": "hidden"}]}
        older = {"id": "r_app_" + "d" * 64, "scope": "test-account", "status": "completed", "messages": []}
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", side_effect=[
                 {"runs": [own, scheduled, foreign], "nextCursor": "cursor-1"},
                 {"runs": [older], "nextCursor": None},
             ]) as transport:
            result = chat.history(Response(), "verified-subject")
        self.assertIsNone(result["sync_error"])
        self.assertEqual([call.args[1] for call in transport.call_args_list], ["/v1/runs", "/v1/runs?before=cursor-1"])
        self.assertEqual(result["turns"], [
            {"run_id": older["id"], "status": "completed", "messages": []},
            {"run_id": RUN, "status": "running",
             "messages": [{"id": "m1", "text": "reply"}, {"id": "m2", "text": "scheduled reply"}]},
        ])

    def test_history_reports_sync_error_without_failing_the_page(self):
        with patch.object(chat.ez, "binding_for", return_value={"bindingId": "test-binding"}), \
             patch.object(chat.ez, "call", side_effect=HTTPException(503, "Ez is unavailable.")):
            result = chat.history(Response(), "verified-subject")
        self.assertEqual(result, {"turns": [], "sync_error": "Ez is unavailable."})

    def test_history_rejects_a_changed_program_selection(self):
        self.account["selected_program_id"] = "program-one"
        with self.assertRaises(HTTPException) as error:
            chat.history(Response(), "verified-subject", program_id="program-two")
        self.assertEqual(error.exception.status_code, 409)

    def test_invalid_run_ids_never_reach_ez(self):
        with patch.object(chat.ez, "call") as transport:
            for run_id in ("../runs", "", "r" * 201):
                with self.subTest(run_id=run_id), self.assertRaises(HTTPException) as error:
                    chat.read_run({"bindingId": "test-binding"}, run_id)
                self.assertEqual(error.exception.status_code, 404)
            transport.assert_not_called()

    def test_invalid_or_oversized_ez_messages_are_rejected(self):
        for messages in (
            [{"id": "reply", "text": "x"}] * (chat.MAX_MESSAGES_PER_RUN + 1),
            [{"id": "reply", "text": "x" * (chat.MAX_MESSAGE_TEXT + 1)}],
            [{"id": "reply"}],
            [{"id": "", "text": "x"}],
        ):
            with self.subTest(size=len(messages)), self.assertRaises(HTTPException):
                chat.messages_of({"messages": messages})

    def test_public_turn_rejects_invalid_status_and_discards_private_fields(self):
        with self.assertRaises(HTTPException):
            chat.public_turn(RUN, {"status": 7})
        turn = chat.public_turn(RUN, {"status": "completed", "messages": [{"id": "reply", "text": "safe", "tool": {"token": "hidden"}}]})
        self.assertEqual(turn, {"run_id": RUN, "status": "completed", "messages": [{"id": "reply", "text": "safe"}]})


if __name__ == "__main__":
    unittest.main()

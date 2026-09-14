import copy
import asyncio
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from eztudy_api import content
from eztudy_publishing.schema import compile_program, revision, validate

EXAMPLE = Path(__file__).resolve().parents[2] / 'examples/first-principles'


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.program = compile_program(EXAMPLE)
        self.grant = {'account_id':'account','tenant_id':'tenant','program_ids':['publishing-qa'],'scopes':['content:publish']}
        self.store = MagicMock()
        self.store.find_one.return_value = None
        self.patcher = patch.object(content, 'programs', self.store)
        self.patcher.start(); self.addCleanup(self.patcher.stop)
        self.account_patch = patch.object(content, 'accounts', MagicMock())
        self.account_patch.start(); self.addCleanup(self.account_patch.stop)

    def test_invalid_and_unauthorized_never_mutate(self):
        for kind, expected in [('video',422), ('markdown',403)]:
            candidate = copy.deepcopy(self.program)
            candidate['items'][0]['content']['type'] = kind
            grant = self.grant | {'program_ids': []}
            with self.assertRaises(HTTPException) as raised:
                content.publish(content.Publication(program=candidate), grant)
            self.assertEqual(raised.exception.status_code, expected)
        self.store.insert_one.assert_not_called(); self.store.replace_one.assert_not_called()

    def test_repeat_is_noop_and_stale_revision_fails(self):
        digest = revision(self.program)
        self.store.find_one.return_value = {'revision':digest, 'receipt':{'revision':digest}}
        result = content.publish(content.Publication(program=self.program), self.grant)
        self.assertTrue(result['unchanged'])
        candidate = self.program | {'title':'Revised'}
        with self.assertRaises(HTTPException) as raised:
            content.publish(content.Publication(program=candidate), self.grant)
        self.assertEqual(raised.exception.status_code,409)
        self.store.replace_one.assert_not_called()

    def test_first_publication_selects_for_new_and_explicitly_empty_accounts(self):
        self.store.insert_one.return_value = None
        content.publish(content.Publication(program=self.program), self.grant)
        query = content.accounts.update_one.call_args.args[0]
        self.assertEqual(query['id'], 'account')
        self.assertIn({'selected_program_id': {'$exists': False}}, query['$or'])
        self.assertIn({'selected_program_id': None}, query['$or'])

    def test_publication_body_is_bounded_before_json_parsing(self):
        class Request:
            async def stream(self):
                yield b'x' * (content.MAX_PUBLICATION_BODY_BYTES + 1)

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(content.publication_from(Request()))
        self.assertEqual(raised.exception.status_code, 413)

    def test_selection_body_is_bounded_before_json_parsing(self):
        class Request:
            async def stream(self):
                yield b'x' * (content.MAX_SELECTION_BODY_BYTES + 1)

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(content.selection_from(Request()))
        self.assertEqual(raised.exception.status_code, 413)

    def test_removal_retains_history_and_generation_guards_aba(self):
        old = {'revision':revision(self.program), 'generation':7, 'versions':[{'program':self.program}]}
        self.store.find_one.return_value = old
        self.store.replace_one.return_value.modified_count = 1
        candidate = self.program | {'items':[]}
        content.publish(content.Publication(program=candidate,expected_revision=old['revision']),self.grant)
        query, record = self.store.replace_one.call_args.args
        self.assertEqual(query['generation'],7)
        self.assertEqual(record['generation'],8)
        self.assertEqual(record['versions'][0]['program']['items'],self.program['items'])
        self.assertEqual(record['program']['items'],[])

    def test_html_and_unsafe_links_rejected(self):
        for body in ['<script>alert(1)</script>', '![picture](https://example.com/x)', '[go](javascript:alert(1))']:
            candidate = copy.deepcopy(self.program)
            candidate['items'][0]['content']['markdown'] = body
            with self.assertRaises(ValueError): validate(candidate)

if __name__ == '__main__': unittest.main()

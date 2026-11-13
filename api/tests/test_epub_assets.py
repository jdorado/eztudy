import asyncio
import hashlib
import io
import unittest
import zipfile
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from eztudy_api import content
from eztudy_publishing.schema import compile_program, validate
from pathlib import Path

class EpubAssetsTests(unittest.TestCase):
    def setUp(self):
        self.grant = {'tenant_id': 'one', 'account_id': 'owner', 'program_ids': ['publishing-qa'], 'scopes': ['content:publish']}
        self.assets = MagicMock()
        p = patch.object(content, 'epub_assets', self.assets); p.start(); self.addCleanup(p.stop)
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as book:
            book.writestr('mimetype', 'application/epub+zip')
            book.writestr('META-INF/container.xml', '<container/>')
            book.writestr('book.opf', '<package/>')
        self.data = output.getvalue()

    def test_scoped_deduplicated_upload_and_exact_download(self):
        receipt = content.save_epub('publishing-qa', self.data, self.grant)
        digest = hashlib.sha256(self.data).hexdigest()
        self.assertEqual(receipt['epub_asset_id'], digest)
        query, update = self.assets.update_one.call_args.args
        self.assertEqual(query, {'_id': 'one:publishing-qa:' + digest})
        self.assertEqual(update['$setOnInsert']['data'], self.data)
        self.assets.find_one.return_value = update['$setOnInsert']
        result = content.inspect_epub('publishing-qa', digest, self.grant)
        self.assertEqual(result.body, self.data)
        self.assertEqual(result.headers['content-type'], 'application/epub+zip')
        self.assertEqual(result.headers['cache-control'], 'no-store')
        with self.assertRaises(HTTPException):
            content.save_epub('other', self.data, self.grant)
        with self.assertRaises(HTTPException):
            content.inspect_epub('other', digest, self.grant)

    def test_cross_tenant_and_program_attachment_rejected_before_publish(self):
        program = compile_program(Path(__file__).resolve().parents[2] / 'examples/first-principles')
        program['items'][0]['epub_asset_id'] = 'a' * 64
        self.assets.find_one.return_value = None
        with self.assertRaises(HTTPException) as raised:
            content.checked(content.Publication(program=program), self.grant)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.assets.find_one.call_args.args[0], {'_id': 'one:publishing-qa:' + 'a' * 64})
        program['items'][0]['epub_asset_id'] = '../bad'
        with self.assertRaises(ValueError): validate(program)

    def test_invalid_and_oversize_archive_never_stored(self):
        for data in (b'PDF', b'x' * (content.MAX_EPUB_BYTES + 1)):
            with self.assertRaises(HTTPException):
                content.save_epub('publishing-qa', data, self.grant)
        self.assets.update_one.assert_not_called()
        class Request:
            async def stream(self): yield b'x' * (content.MAX_EPUB_BYTES + 1)
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(content.upload_epub('publishing-qa', Request(), self.grant))
        self.assertEqual(raised.exception.status_code, 413)

    def test_item_prefers_saved_book_and_notes_remain_explicit(self):
        item = {'id': 'reading', 'title': 'Book', 'epub_asset_id': 'a' * 64, 'reader_url': 'https://example.com'}
        self.assets.find_one.return_value = {'data': self.data}
        with patch.object(content, 'account_for', return_value={'tenant_id': 'one'}), patch.object(content, 'programs') as programs, patch.object(content, 'fetch_reader_html') as fetch, patch.object(content, 'item_epub', return_value=b'notes'):
            programs.find_one.return_value = {'program': {'items': [item]}}
            self.assertEqual(content.reader_epub('publishing-qa', 'reading', 'subject').body, self.data)
            fetch.assert_not_called()
            self.assertEqual(content.reader_epub('publishing-qa', 'reading', 'subject', notes=True).body, b'notes')
            self.assertEqual(programs.find_one.call_args.args[0], {'_id': 'one:publishing-qa'})

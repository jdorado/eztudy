import unittest
from io import BytesIO
from unittest.mock import MagicMock, patch
from xml.etree import ElementTree
from zipfile import ZipFile

from fastapi import HTTPException

from eztudy_api import content
from eztudy_api.reader_epub import private_reader_epub


class ReaderEpubTests(unittest.TestCase):
    def test_export_keeps_paper_text_and_rejects_active_html(self):
        html = ('<nav><img src="bad"><p>Site chrome</p></nav><article class="ltx_document">'
                '<h1>Paper</h1><p>' + 'Readable paper text. ' * 35 +
                '<math alttext="x^2"><semantics>ignored</semantics></math>'
                '<a href="javascript:alert(1)">unsafe link</a></p><script>bad()</script></article>')
        epub = private_reader_epub(source_html=html, source_url='https://arxiv.org/html/2402.08954', title='Paper')
        with ZipFile(BytesIO(epub)) as archive:
            self.assertEqual(archive.read('mimetype'), b'application/epub+zip')
            chapter = archive.read('OEBPS/reader.xhtml').decode()
            ElementTree.fromstring(chapter)
            self.assertIn('Readable paper text.', chapter)
            self.assertIn('x^2', chapter)
            self.assertNotIn('Site chrome', chapter)
            self.assertNotIn('javascript:', chapter)
            self.assertNotIn('bad()', chapter)

    def test_download_uses_authenticated_tenant_item_and_declared_url(self):
        source = 'https://arxiv.org/html/2402.08954'
        record = {'program': {'items': [{'id': 'paper', 'title': 'Paper', 'reader_url': source}]}}
        store = MagicMock()
        store.find_one.return_value = record
        with patch.object(content, 'account_for', return_value={'tenant_id': 'tenant'}), \
             patch.object(content, 'programs', store), \
             patch.object(content, 'fetch_reader_html', return_value='<article class="ltx_document">' + 'Paper text. ' * 60 + '</article>') as fetch:
            response = content.reader_epub('course', 'paper', 'verified-subject')
            self.assertEqual(response.media_type, 'application/epub+zip')
            self.assertEqual(response.headers['cache-control'], 'no-store')
            store.find_one.assert_called_with({'_id': 'tenant:course'})
            fetch.assert_called_once_with(source)
            with self.assertRaises(HTTPException) as missing:
                content.reader_epub('course', 'another-item', 'verified-subject')
            self.assertEqual(missing.exception.status_code, 404)
            self.assertEqual(fetch.call_count, 1)


if __name__ == '__main__':
    unittest.main()

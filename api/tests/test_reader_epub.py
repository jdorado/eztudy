import unittest
import asyncio
import json
from io import BytesIO
from email.message import Message
import socket
from unittest.mock import MagicMock, patch
from xml.etree import ElementTree
from zipfile import ZipFile

from fastapi import HTTPException

from eztudy_api import content
from starlette.requests import Request

from eztudy_api import reader_epub as exporter
from eztudy_api.reader_epub import private_reader_epub, text_epub


def chapter(epub):
    with ZipFile(BytesIO(epub)) as archive:
        assert archive.testzip() is None
        assert archive.infolist()[0].filename == 'mimetype'
        assert archive.infolist()[0].compress_type == 0
        for name in archive.namelist():
            if name.endswith(('.xml', '.xhtml', '.opf')):
                ElementTree.fromstring(archive.read(name))
        return archive.read('OEBPS/reader.xhtml').decode()


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
             patch.object(content, 'fetch_reader_html', return_value=('<article class="ltx_document">' + 'Paper text. ' * 60 + '</article>', source)) as fetch:
            response = content.reader_epub('course', 'paper', 'verified-subject')
            self.assertEqual(response.media_type, 'application/epub+zip')
            self.assertEqual(response.headers['cache-control'], 'no-store')
            store.find_one.assert_called_with({'_id': 'tenant:course'})
            fetch.assert_called_once_with(source)
            with self.assertRaises(HTTPException) as missing:
                content.reader_epub('course', 'another-item', 'verified-subject')
            self.assertEqual(missing.exception.status_code, 404)
            self.assertEqual(fetch.call_count, 1)

    def test_own_content_preserves_formatting_unicode_and_sources_without_fetching(self):
        item = {'id': 'notes', 'title': 'Ideas & café', 'purpose': 'My reading',
                'content': {'type': 'markdown', 'markdown': '## Chapter\n\n**Bold** and *italic*.\n\n- First\n- Second\n\n```\nx < 3\n```'},
                'provenance': {'text': 'Written by me', 'sources': [{'title': 'Source', 'url': 'https://example.com/'}]}}
        store = MagicMock()
        store.find_one.return_value = {'program': {'items': [item]}}
        with patch.object(content, 'account_for', return_value={'tenant_id': 'tenant'}), \
             patch.object(content, 'programs', store), patch.object(content, 'fetch_reader_html') as fetch:
            result = chapter(content.reader_epub('course', 'notes', 'subject').body)
            for expected in ('Ideas &amp; café', '<h2>Chapter</h2>', '<strong>Bold</strong>', '<li>First</li>', 'x &lt; 3', 'Written by me', 'https://example.com/'):
                self.assertIn(expected, result)
            fetch.assert_not_called()
            store.find_one.assert_called_with({'_id': 'tenant:course'})
        self.assertIn('Short note', chapter(text_epub(title='Note', markdown='Short note')))

    def test_article_without_arxiv_markup_keeps_text_and_resolves_links(self):
        source = '<html><head><title>A web essay</title></head><body><nav>Ignore navigation</nav><main><article><h1>A web essay</h1><p>' + 'An independently written paragraph about reading and ideas. ' * 30
        source += '</p><p><a href="/next">Next reading</a><img src="/track" alt="A diagram" /></p><script>bad()</script></article></main><footer>Ignore footer</footer></body></html>'
        result = chapter(private_reader_epub(source_html=source, source_url='https://example.com/essay'))
        self.assertIn('An independently written paragraph', result)
        self.assertIn('https://example.com/next', result)
        self.assertIn('A web essay', result)
        for forbidden in ('Ignore navigation', 'Ignore footer', 'bad()', '<img', '<script'):
            self.assertNotIn(forbidden, result)
        for empty in ('', '<html></html>', '<p>Sign in</p>'):
            with self.subTest(empty=empty), self.assertRaises(ValueError):
                private_reader_epub(source_html=empty, source_url='https://example.com')

    def test_public_fetch_rejects_private_addresses_and_rechecks_redirects(self):
        for address in ('127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1'):
            with self.subTest(address=address), patch.object(socket, 'getaddrinfo', return_value=[(0, 0, 0, '', (address, 443))]), \
                 patch.object(exporter, 'PublicHTTPSConnection') as connection, self.assertRaises(ValueError):
                exporter.fetch_reader_html('https://example.com')
            connection.assert_not_called()
        for url in ('http://example.com', 'https://user@example.com', 'https://example.com:8443', 'file:///etc/passwd'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                exporter.fetch_reader_html(url)
        public = [(0, 0, 0, '', ('93.184.216.34', 443))]
        private = [(0, 0, 0, '', ('127.0.0.1', 443))]
        with patch.object(socket, 'getaddrinfo', side_effect=[public, private]), patch.object(exporter, 'PublicHTTPSConnection') as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 302
            response.getheader.return_value = 'https://localhost/private'
            with self.assertRaises(ValueError):
                exporter.fetch_reader_html('https://example.com')
            self.assertEqual(connection.call_count, 1)
            self.assertEqual(connection.call_args.args[:2], ('example.com', '93.184.216.34'))
            connection.return_value.close.assert_called_once()

    def test_fetch_is_bounded_and_returns_final_url(self):
        with patch.object(exporter, 'public_address', return_value=('example.com', '93.184.216.34')), \
             patch.object(exporter, 'PublicHTTPSConnection') as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 200
            response.headers = Message()
            response.headers['Content-Type'] = 'text/html; charset=utf-8'
            response.getheader.return_value = 'identity'
            response.read1.side_effect = [b'<p>Article</p>', b'']
            self.assertEqual(exporter.fetch_reader_html('https://example.com'), ('<p>Article</p>', 'https://example.com'))
            with patch.object(exporter, 'MAX_HTML_BYTES', 8):
                response.read1.side_effect = [b'123456789']
                with self.assertRaises(ValueError): exporter.fetch_reader_html('https://example.com')

    def test_standalone_export_admits_account_and_bounds_input(self):
        async def run(payload, admitted=True):
            data = json.dumps(payload).encode()
            async def receive(): return {'type': 'http.request', 'body': data, 'more_body': False}
            request = Request({'type': 'http'}, receive=receive)
            with patch.object(content, 'account_for', side_effect=None if admitted else HTTPException(403)) as account:
                response = await content.create_epub_route(request, 'subject')
                account.assert_called_once_with('subject')
                return response
        payload = {'kind': 'text', 'title': 'My book', 'markdown': 'Original content'}
        self.assertIn('Original content', chapter(asyncio.run(run(payload)).body))
        with self.assertRaises(HTTPException) as denied:
            asyncio.run(run(payload, admitted=False))
        self.assertEqual(denied.exception.status_code, 403)
        for invalid in (payload | {'markdown': ' '}, payload | {'url': 'https://example.com'}, payload | {'markdown': 'x' * 650001}):
            with self.assertRaises(HTTPException): asyncio.run(run(invalid))


if __name__ == '__main__':
    unittest.main()

"""On-demand personal EPUB export of an agent-declared arXiv HTML paper."""
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
from io import BytesIO
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from eztudy_publishing.schema import arxiv_reader_url

MAX_HTML_BYTES = 8 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def fetch_reader_html(url: str) -> str:
    arxiv_reader_url(url)
    request = Request(url, headers={'User-Agent': 'Eztudy private reader/1.0 (+https://eztudy.space)'})
    try:
        with build_opener(NoRedirect()).open(request, timeout=20) as response:
            if not response.headers.get_content_type() == 'text/html':
                raise ValueError('The arXiv reader did not return HTML.')
            body = response.read(MAX_HTML_BYTES + 1)
            if len(body) > MAX_HTML_BYTES:
                raise ValueError('The arXiv HTML paper is too large to export.')
            return body.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
    except (HTTPError, URLError, TimeoutError) as error:
        raise ValueError('The arXiv HTML paper could not be retrieved.') from error


class ReaderParser(HTMLParser):
    """Keep arXiv's paper body and text, omitting page chrome and active HTML."""

    block_tags = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre'}
    inline_tags = {'em', 'i', 'strong', 'b', 'code', 'sup', 'sub'}
    skip_tags = {'script', 'style', 'nav', 'header', 'footer', 'svg', 'form', 'button', 'iframe'}
    void_tags = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr'}

    def __init__(self, source_url: str):
        super().__init__(convert_charrefs=True)
        self.source_url = source_url
        self.article_depth = 0
        self.skip_depth = 0
        self.math_depth = 0
        self.links: list[bool] = []
        self.parts: list[str] = []
        self.text_length = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if self.math_depth:
            self.math_depth += 1
            return
        if self.skip_depth:
            if tag not in self.void_tags:
                self.skip_depth += 1
            return
        if not self.article_depth:
            classes = (values.get('class') or '').split()
            if tag == 'article' and (values.get('data-type') == 'main' or 'ltx_document' in classes):
                self.article_depth = 1
            return
        if tag == 'article':
            self.article_depth += 1
        elif tag in self.skip_tags:
            self.skip_depth = 1
        elif tag == 'math':
            latex = values.get('alttext') or ''
            if latex:
                self.parts.append(f'<code>{escape(latex)}</code>')
                self.text_length += len(latex)
            self.math_depth = 1
        elif tag in self.block_tags or tag in self.inline_tags:
            self.parts.append(f'<{tag}>')
        elif tag == 'br':
            self.parts.append('<br/>')
        elif tag == 'a':
            href = urljoin(self.source_url, values.get('href') or '')
            parsed = urlsplit(href)
            valid = parsed.scheme in {'https', 'http'} and bool(parsed.hostname) and not parsed.username
            self.links.append(valid)
            if valid:
                self.parts.append(f'<a href="{escape(href, quote=True)}">')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if self.math_depth:
            self.math_depth -= 1
            return
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if not self.article_depth:
            return
        if tag == 'article':
            self.article_depth -= 1
        elif tag in self.block_tags or tag in self.inline_tags:
            self.parts.append(f'</{tag}>')
        elif tag == 'a' and self.links:
            if self.links.pop():
                self.parts.append('</a>')

    def handle_data(self, data):
        if self.article_depth and not self.skip_depth and not self.math_depth:
            self.parts.append(escape(data))
            self.text_length += len(data.strip())


def private_reader_epub(*, source_html: str, source_url: str, title: str) -> bytes:
    parser = ReaderParser(source_url)
    parser.feed(source_html)
    parser.close()
    if parser.text_length < 500:
        raise ValueError('The arXiv reader did not provide a readable paper.')
    article = ''.join(parser.parts).strip()
    safe_title = escape(title)
    safe_source = escape(source_url, quote=True)
    identifier = sha256(source_url.encode()).hexdigest()
    modified = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    chapter = f'''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{safe_title}</title>
<style>body{{font-family:serif;line-height:1.58;margin:7%}}p{{margin:0 0 1em}}blockquote{{margin:1em;padding-left:1em;border-left:3px solid #ccd7ec}}code{{overflow-wrap:anywhere}}</style>
</head><body><p><small>Private reader export · <a href="{safe_source}">Original source</a></small></p>{article}</body></html>'''
    nav = f'''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="reader.xhtml">{safe_title}</a></li></ol></nav></body></html>'''
    package = f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">eztudy-private-{identifier}</dc:identifier><dc:title>{safe_title}</dc:title><dc:language>en</dc:language><dc:source>{safe_source}</dc:source><meta property="dcterms:modified">{modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="reader" href="reader.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="reader"/></spine></package>'''
    container = '''<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'''
    output = BytesIO()
    with ZipFile(output, 'w') as epub:
        epub.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
        epub.writestr('META-INF/container.xml', container, compress_type=ZIP_DEFLATED)
        epub.writestr('OEBPS/reader.xhtml', chapter, compress_type=ZIP_DEFLATED)
        epub.writestr('OEBPS/nav.xhtml', nav, compress_type=ZIP_DEFLATED)
        epub.writestr('OEBPS/content.opf', package, compress_type=ZIP_DEFLATED)
    return output.getvalue()

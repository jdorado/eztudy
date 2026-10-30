"""Private, on-demand EPUBs from learner text, published Items, and public articles."""
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
from http.client import HTTPSConnection, HTTPException
from io import BytesIO
from ipaddress import ip_address
import re
import socket
from time import monotonic
from urllib.parse import quote, urljoin, urlsplit
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from lxml import etree, html
from markdown_it import MarkdownIt
from readability import Document

MAX_HTML_BYTES = 8 * 1024 * 1024
FETCH_SECONDS = 25


def public_address(url: str) -> tuple[str, str]:
    """Validate every destination, including redirects, before opening a socket."""
    parsed = urlsplit(url)
    if (len(url) > 2000 or re.search(r'[\s\\\x00-\x1f\x7f]', url)
            or parsed.scheme != 'https' or not parsed.hostname or parsed.port not in (None, 443)
            or parsed.username is not None or parsed.password is not None):
        raise ValueError('Use a public HTTPS article URL without credentials or a custom port.')
    host = parsed.hostname.encode('idna').decode('ascii')
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ip_address(entry[4][0]).is_global or ip_address(entry[4][0]).is_multicast for entry in addresses):
        raise ValueError('Only public website addresses can be exported.')
    return host, addresses[0][4][0]


class PublicHTTPSConnection(HTTPSConnection):
    """Pin the checked IP while retaining the original TLS hostname and Host header."""
    def __init__(self, host: str, address: str, timeout: float):
        super().__init__(host, timeout=timeout)
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            sock.close()
            raise


def fetch_reader_html(url: str) -> tuple[str, str]:
    deadline = monotonic() + FETCH_SECONDS
    try:
        for _ in range(5):
            host, address = public_address(url)
            parsed = urlsplit(url)
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise TimeoutError()
            connection = PublicHTTPSConnection(host, address, remaining)
            try:
                path = quote(parsed.path or '/', safe="/%:@!$&'()*+,;=-._~")
                if parsed.query:
                    path += '?' + quote(parsed.query, safe="%/:?@!$&'()*+,;=-._~")
                connection.request('GET', path, headers={
                    'User-Agent': 'Eztudy private reader/1.0 (+https://eztudy.space)',
                    'Accept': 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity',
                })
                response = connection.getresponse()
                if response.status in (301, 302, 303, 307, 308):
                    location = response.getheader('Location')
                    if not location:
                        raise ValueError('The article redirected without a destination.')
                    url = urljoin(url, location)
                    continue
                if response.status != 200:
                    raise ValueError('The website did not allow article access. Paste the text you can read instead.')
                if response.headers.get_content_type() not in ('text/html', 'application/xhtml+xml'):
                    raise ValueError('This URL is not an HTML article. Paste its text instead.')
                if response.getheader('Content-Encoding', 'identity') != 'identity':
                    raise ValueError('The website returned an unsupported encoding. Paste the article text instead.')
                body = bytearray()
                while True:
                    remaining = deadline - monotonic()
                    if remaining <= 0:
                        raise TimeoutError()
                    if connection.sock:
                        connection.sock.settimeout(remaining)
                    chunk = response.read1(min(65536, MAX_HTML_BYTES + 1 - len(body)))
                    body.extend(chunk)
                    if len(body) > MAX_HTML_BYTES:
                        raise ValueError('The article is too large to export.')
                    if not chunk:
                        break
                charset = response.headers.get_content_charset() or 'utf-8'
                return body.decode(charset, errors='replace'), url
            finally:
                connection.close()
        raise ValueError('The article redirected too many times. Use its final URL.')
    except (OSError, HTTPException, LookupError) as error:
        raise ValueError('The article could not be retrieved. Try again or paste its text.') from error


ALLOWED_TAGS = set('div section h1 h2 h3 h4 h5 h6 p ul ol li blockquote pre em i strong b code sup sub a br hr table thead tbody tfoot tr th td caption figure figcaption'.split())
DROP_TAGS = set('script style nav footer aside form button input iframe object embed svg noscript template'.split())


def clean_xhtml(source_html: str, source_url: str = '') -> str:
    """Parse forgiving HTML, then serialize a strict, inert XHTML allowlist."""
    root = html.fragment_fromstring(source_html, create_parent='div')
    for node in list(root.iterdescendants()):
        if node.getparent() is None:
            continue
        if not isinstance(node.tag, str):
            node.drop_tree()
            continue
        tag = node.tag.lower()
        attrs = dict(node.attrib)
        node.attrib.clear()
        if tag in DROP_TAGS or 'hidden' in attrs or attrs.get('aria-hidden') == 'true':
            node.drop_tree()
        elif tag == 'math':
            text = attrs.get('alttext') or ''.join(node.itertext())
            node.tag = 'code'
            node[:] = []
            node.text = text
        elif tag == 'img':
            node.tag = 'span'
            node.text = f"[{attrs['alt']}]" if attrs.get('alt') else ''
        elif tag not in ALLOWED_TAGS:
            node.drop_tag()
        elif tag == 'a':
            href = urljoin(source_url, attrs.get('href', ''))
            parsed = urlsplit(href)
            if (parsed.scheme in ('https', 'http') and parsed.hostname
                    and parsed.username is None and parsed.password is None):
                node.set('href', href)
        elif tag == 'ol' and re.fullmatch(r'\d{1,6}', attrs.get('start', '')):
            node.set('start', attrs['start'])
    return etree.tostring(root, encoding='unicode', method='xml')


def text_epub(*, title: str, markdown: str) -> bytes:
    if not title.strip() or not markdown.strip():
        raise ValueError('Add a title and some text to create an EPUB.')
    rendered = MarkdownIt('js-default').render(markdown)
    return build_epub(title=title, article=clean_xhtml(rendered))


def item_epub(item: dict) -> bytes:
    # Keep canonical title, purpose, content and attribution in the private copy.
    article = '<p>' + escape(item['purpose']) + '</p>'
    body = MarkdownIt('js-default').render(item['content']['markdown'])
    article += clean_xhtml(body)
    if item['content'].get('url'):
        url = escape(item['content']['url'], quote=True)
        article += f'<p><a href="{url}">Original media</a></p>'
    article += '<h2>Sources and attribution</h2><p>' + escape(item['provenance']['text']) + '</p>'
    if item['provenance']['sources']:
        article += '<ul>'
        for source in item['provenance']['sources']:
            article += f'<li><a href="{escape(source["url"], quote=True)}">{escape(source["title"])}</a></li>'
        article += '</ul>'
    return build_epub(title=item['title'], article=clean_xhtml(article))


def private_reader_epub(*, source_html: str, source_url: str, title: str = '') -> bytes:
    document = Document(source_html, url=source_url)
    try:
        root = html.fromstring(source_html)
    except etree.ParserError as error:
        raise ValueError('No readable article was found. Paste the article text instead.') from error
    if len(''.join(root.itertext()).strip()) < 200:
        raise ValueError('No readable article was found. Paste the article text instead.')
    # Preserve the complete scientific paper and math instead of scoring its sections.
    papers = root.xpath('//article[@data-type="main" or contains(concat(" ", normalize-space(@class), " "), " ltx_document ")]')
    extracted = html.tostring(papers[0], encoding='unicode') if papers else document.summary()
    article = clean_xhtml(extracted, source_url)
    if len(''.join(html.fromstring(article).itertext()).strip()) < 200:
        raise ValueError('No readable article was found. Paste the article text instead.')
    return build_epub(title=title.strip() or document.short_title() or 'Web article', article=article, source_url=source_url)


def build_epub(*, title: str, article: str, source_url: str = '') -> bytes:
    title = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]', '', title)
    safe_title = escape(title)
    safe_source = escape(source_url, quote=True)
    identifier = sha256((title + source_url + article).encode()).hexdigest()
    modified = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    source_link = f'<p><a href="{safe_source}">Original article</a></p>' if source_url else ''
    chapter = f'''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>{safe_title}</title>
<style>body{{font-family:serif;line-height:1.5}}p{{margin:0 0 1em}}blockquote{{margin:1em;padding-left:1em;border-left:2px solid #888}}pre{{white-space:pre-wrap}}code{{overflow-wrap:anywhere}}table{{border-collapse:collapse}}td,th{{border:1px solid #888;padding:.3em}}</style>
</head><body><h1>{safe_title}</h1>{source_link}{article}</body></html>'''
    nav = f'''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="reader.xhtml">{safe_title}</a></li></ol></nav></body></html>'''
    source_meta = f'<dc:source>{safe_source}</dc:source>' if source_url else ''
    package = f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">eztudy-private-{identifier}</dc:identifier><dc:title>{safe_title}</dc:title><dc:language>en</dc:language>{source_meta}<meta property="dcterms:modified">{modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="reader" href="reader.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="reader"/></spine></package>'''
    container = '''<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'''
    output = BytesIO()
    with ZipFile(output, 'w') as epub:
        epub.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
        epub.writestr('META-INF/container.xml', container, compress_type=ZIP_DEFLATED)
        epub.writestr('OEBPS/reader.xhtml', chapter, compress_type=ZIP_DEFLATED)
        epub.writestr('OEBPS/nav.xhtml', nav, compress_type=ZIP_DEFLATED)
        epub.writestr('OEBPS/content.opf', package, compress_type=ZIP_DEFLATED)
    return output.getvalue()

"""Deterministic flat Markdown publication validation; shared by API and CLI."""
import hashlib
import json
import re
from pathlib import Path

MAX_BYTES = 1_000_000
ID = re.compile(r"[a-z][a-z0-9-]{0,79}\Z")


def fields(value, required):
    if not isinstance(value, dict) or set(value) != set(required):
        raise ValueError('Expected fields: ' + ', '.join(required))


def string(value, name, maximum=2000):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f'{name} must be nonempty text, at most {maximum} characters')
    return value


def identifier(value):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError('IDs must use lowercase letters, digits and hyphens, starting with a letter (max 80)')


def validate(program):
    fields(program, ['id', 'title', 'purpose', 'items'])
    identifier(program['id'])
    string(program['title'], 'title', 200)
    string(program['purpose'], 'purpose', 12000)
    if not isinstance(program['items'], list) or len(program['items']) > 100:
        raise ValueError('items must be an ordered array of at most 100 Items')
    seen = set()
    for item in program['items']:
        fields(item, ['id', 'title', 'purpose', 'tags', 'content', 'provenance'])
        identifier(item['id'])
        if item['id'] in seen:
            raise ValueError('Duplicate Item ID')
        seen.add(item['id'])
        string(item['title'], 'Item title', 200)
        string(item['purpose'], 'Item purpose', 2000)
        tags = item['tags']
        if not isinstance(tags, list) or len(tags) > 20:
            raise ValueError('tags must be an array of at most 20 labels')
        for tag in tags:
            string(tag, 'tag', 80)
        if len(set(tags)) != len(tags):
            raise ValueError('Duplicate tag')
        fields(item['content'], ['type', 'markdown'])
        if item['content']['type'] != 'markdown':
            raise ValueError('Only markdown content is supported')
        body = string(item['content']['markdown'], 'Markdown body', 100000)
        # Raw HTML, media and executable embeds are outside the Markdown-only contract.
        if re.search(r'<\s*/?\s*[a-zA-Z!]|!\[', body):
            raise ValueError('HTML and media are not supported')
        for url in re.findall(r'\]\(([^\s)]+)', body):
            if not re.match(r'https?://[^\s]+\Z', url):
                raise ValueError('Markdown links must use HTTP(S) URLs')
        fields(item['provenance'], ['text', 'sources'])
        string(item['provenance']['text'], 'provenance', 4000)
        sources = item['provenance']['sources']
        if not isinstance(sources, list) or len(sources) > 30:
            raise ValueError('sources must be an array of at most 30 sources')
        for source in sources:
            fields(source, ['title', 'url'])
            string(source['title'], 'source title', 300)
            url = string(source['url'], 'source URL', 2000)
            if not re.fullmatch(r'https?://[^\s]+', url):
                raise ValueError('Source URLs must use HTTP(S)')
    if len(canonical(program)) > MAX_BYTES:
        raise ValueError('Program exceeds 1 MB publication limit')
    return program


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def revision(program):
    return hashlib.sha256(canonical(program)).hexdigest()


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate metadata field: ' + key)
        value[key] = item
    return value


def document(path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('Source file exceeds 1 MB')
    text = path.read_text(encoding='utf-8')
    parts = text.split('---', 2)
    if len(parts) != 3 or parts[0].strip():
        raise ValueError('Start Markdown with --- JSON metadata ---')
    metadata = json.loads(parts[1], object_pairs_hook=unique_object)
    return metadata, parts[2].strip()


def compile_program(directory):
    root = Path(directory).resolve(strict=True)
    if (root / 'program.md').is_symlink():
        raise ValueError('Symlink sources are not supported')
    meta, purpose = document(root / 'program.md')
    fields(meta, ['id', 'title', 'items'])
    if not isinstance(meta['items'], list) or len(meta['items']) > 100:
        raise ValueError('items must contain at most 100 relative Markdown references')
    items, seen = [], set()
    for ref in meta['items']:
        if not isinstance(ref, str) or not re.fullmatch(r'items/[a-z0-9-]+\.md', ref) or ref in seen:
            raise ValueError('Use unique items/name.md references')
        seen.add(ref)
        path = root / ref
        if path.is_symlink() or path.parent.is_symlink() or not path.resolve(strict=True).is_relative_to(root):
            raise ValueError('Item reference escapes Program directory')
        metadata, body = document(path)
        fields(metadata, ['id', 'title', 'purpose', 'tags', 'type', 'provenance'])
        items.append({key: metadata[key] for key in ['id', 'title', 'purpose', 'tags', 'provenance']} |
                     {'content': {'type': metadata['type'], 'markdown': body}})
    return validate({'id': meta['id'], 'title': meta['title'], 'purpose': purpose, 'items': items})

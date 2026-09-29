"""Check/publish Markdown only. No generation, execution or context collection."""
import argparse
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
from urllib.parse import urlparse

from .schema import compile_program, revision


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('API redirects are not permitted')


def main():
    parser = argparse.ArgumentParser(
        prog='eztudy',
        description='Read, validate, or publish Programs through the authenticated Eztudy API.',
        epilog='One Item per reading or activity. Weeks and sessions are shared tags, '
               'not container Items. Read the installed authoring skill for the file format. '
               'Types: markdown, video, podcast, movie. Media require an HTTPS url and Markdown notes; '
               'they open on the source website. '
               'check validates structure and authorization, not how activities are split. '
               'After publishing, use show to verify Item titles, order and tags against the request.',
    )
    parser.add_argument('--version', action='version', version='eztudy 0.1.4')
    parser.add_argument('operation', choices=['list', 'show', 'check', 'publish'])
    parser.add_argument('target', nargs='?', help='Program ID for show; source directory for check/publish')
    args = parser.parse_args()
    if (args.operation == 'list' and args.target) or (args.operation != 'list' and not args.target):
        parser.error('list takes no target; show needs a Program ID; check/publish need a source directory')
    try:
        config_file = os.environ.get('EZTUDY_CONFIG_FILE')
        config = json.loads(Path(config_file).read_text()) if config_file else {}
        origin = os.environ.get('EZTUDY_API_URL', config.get('api_url', '')).rstrip('/')
        parsed = urlparse(origin)
        if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in {'localhost', '127.0.0.1', 'host.docker.internal'}):
            raise ValueError('Configure HTTPS EZTUDY_API_URL (or a local QA endpoint)')
        if parsed.path not in {'', '/'} or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError('EZTUDY_API_URL must be an origin')
        token = Path(os.environ.get('EZTUDY_TOKEN_FILE', config.get('token_file', ''))).read_text().strip()
        if args.operation in {'list', 'show'}:
            from urllib.parse import quote
            read_path = '/api/content/published' + ('/' + quote(args.target, safe='') if args.operation == 'show' else '')
            request = Request(origin + read_path,
                              headers={'Authorization': 'Bearer ' + token})
            with build_opener(NoRedirect).open(request, timeout=30) as response:
                result = json.load(response)
            print(json.dumps(result))
            return 0
        program = compile_program(args.target)
        receipt_dir = config.get('receipt_directory')
        if receipt_dir:
            Path(receipt_dir).mkdir(parents=True, exist_ok=True)
        receipt_file = Path(receipt_dir) / (program['id'] + '.json') if receipt_dir else Path(args.target) / '.eztudy-receipt.json'
        receipt = json.loads(receipt_file.read_text()) if receipt_file.exists() else {}
        if receipt and receipt.get('program_id') != program['id']:
            raise ValueError('Receipt belongs to another Program')
        body = {'program': program, 'expected_revision': receipt.get('revision')}
        request = Request(origin + '/api/content/' + args.operation,
                          data=json.dumps(body, ensure_ascii=False).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        with build_opener(NoRedirect).open(request, timeout=30) as response:
            result = json.load(response)
        if args.operation == 'publish':
            if result.get('revision') != revision(program):
                raise ValueError('API receipt does not match the checked source')
            # Receipt is a local publication marker, not agent memory; no secret inside.
            temporary = receipt_file.with_suffix('.tmp')
            temporary.write_text(json.dumps(result, indent=2) + '\n')
            temporary.replace(receipt_file)
        print(json.dumps(result))
    except HTTPError as error:
        try:
            detail = json.load(error).get('detail', 'API request failed')
        except (ValueError, OSError):
            detail = 'API request failed'
        print(json.dumps({'error': detail, 'status': error.code}), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

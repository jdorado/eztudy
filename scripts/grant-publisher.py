#!/usr/bin/env python3
"""Installation administrator only. Write a Program-scoped credential privately."""
import argparse
import hashlib
import json
import os
import secrets
from pathlib import Path
from eztudy_api.database import accounts, database
from eztudy_publishing.schema import identifier

parser = argparse.ArgumentParser()
parser.add_argument('--account-id', required=True)
parser.add_argument('--program-id', required=True, action='append')
parser.add_argument('--token-file', required=True)
args = parser.parse_args()
account = accounts.find_one({'id': args.account_id})
if not account:
    parser.error('Account does not exist; authenticate in the app first')
for program_id in args.program_id:
    identifier(program_id)
path = Path(args.token_file)
if not path.is_absolute():
    parser.error('Use an absolute private token path outside the workspace')
path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
token = secrets.token_urlsafe(48)
with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
    output.write(token + '\n')
database.publication_credentials.insert_one({'_id': hashlib.sha256(token.encode()).hexdigest(),
    'account_id': account['id'], 'tenant_id': account['tenant_id'],
    'program_ids': args.program_id, 'scopes': ['content:publish'], 'revoked': False})
print(json.dumps({'created': True, 'program_ids': args.program_id}))

# Markdown publishing

The complete source convention and supported Markdown subset are in
[the plugin authoring skill](../plugin/skills/authoring/SKILL.md). A redistributable
Program is in `examples/first-principles/`. JSON metadata between `---` delimiters
keeps the first contract deterministic without a separate YAML/compiler hierarchy.

After `cd api && uv sync --locked`, the `eztudy` entry point is available through
`uv run eztudy`. All operations require an authorized publisher connection:

```sh
export EZTUDY_API_URL=https://your-api.example
export EZTUDY_TOKEN_FILE=/private/eztudy-publisher-token
uv run eztudy check /path/to/program
uv run eztudy publish /path/to/program
uv run eztudy show your-program-id
```

Check is read-only but validates server-side permissions as well as source shape.
Publish rechecks and returns JSON containing `id`, `program_id`, `revision`,
`published_at`, and `unchanged`. The CLI verifies that revision against the source
and writes a non-secret `.eztudy-receipt.json` for subsequent optimistic updates.
Keep that ignored marker with the source. Do not erase it to force a stale publish.
A CLI error or draft file is not a successful publication.

For Docker plugin usage, the connection and receipts live in the private plugin
volume; authored source stays read-only. See [plugin setup](../plugin/README.md).
The same validation module is imported by the API; no duplicated content schema.

The installing administrator runs `scripts/grant-publisher.py` through the API's
configured Python environment, supplying an existing canonical account ID,
explicit `--program-id` values and a private `--token-file` destination. It creates
a random credential and stores only its SHA-256 digest in MongoDB. This command
is not an HTTP endpoint, native tool or self-service grant. Never grant from
Markdown identity fields. Revoke by setting `revoked:true` on its hashed credential
record; do not expose the credential through chat or frontend configuration.

API operations:

- `POST /api/content/check`, `POST /api/content/publish`: publisher credential;
  body `{program, expected_revision}`.
- `GET /api/content/published` and `/published/{program_id}`: publisher credential;
  only Programs granted to that credential.
- `GET /api/content`: Privy token; canonical Programs, selection and receipts.
- `POST /api/content/selection`: Privy token; body `{program_id}`; owned Program only.
- Chat reads/submissions carry the selected `program_id`; stale selection fails
  closed. Optional visible `item_id` is validated within that Program.

Invalid/unauthorized input leaves the active revision untouched. Conflicting
updates return 409. Prior versions retain removed Items. Each Program uses one
atomic Mongo document with a 12 MB history ceiling; the API refuses overflow.
No archival, destructive source management, media, widgets or native generation
service is included.

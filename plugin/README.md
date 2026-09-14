# Eztudy publisher plugin

A deterministic Docker CLI and authoring skill. No model calls, agent runtime,
execution queue or content generation. The API uses this same validation package.

Install through the existing Ez manager (`ez plugins inspect/install`) with its
returned SHA-256 revision. Bind the owning workspace read-only to
`/state/source` through the documented `plugins folder-bind` operation. No
persistent publisher service is needed: commands run in disposable containers.

The administrator creates a Program-scoped token with Eztudy's
`scripts/grant-publisher.py`, stores it in this deployment's private `state` volume
at `/state/token`, and writes `/state/connection.json`:

```json
{"api_url":"https://your-eztudy-api.example","token_file":"/state/token","receipt_directory":"/state/receipts"}
```

Use file permissions 0600 owned by UID 1000. The credential never belongs in
metadata, argv, authored Markdown or the native environment. API grants, not the
source, select tenant and writable Program IDs. Revocation sets the matching
hashed MongoDB credential record's `revoked` field to true. No API account or
other credential is usable as a publisher bearer token.

Check is read-only and authenticated. Publish validates again and returns a
revision-matching receipt. Failures use nonzero exit and JSON stderr. CLI help and
version work without credentials. HTTPS is required except local QA origins.
No redirects are followed. The mounted workspace is read-only; receipts live in
private plugin storage. Installation alone is not acceptance: require native
file authorship, CLI receipt and authenticated frontend readback.

Stop/status use ordinary Ez lifecycle commands if the optional service was
started. There is no schema migration or persistent worker. Uninstall through Ez
preserves its volumes and receipts; revoke the API grant separately. Reinstall
preserves the connection; inspect/pin changed packages before upgrade. Do not
start a second publisher or erase receipts to bypass conflicts. Only one source
workspace should own a Program at a time.

# Eztudy publisher plugin

A deterministic Docker CLI and authoring skill. No model calls, agent runtime,
execution queue or content generation. The API uses this same validation package.

This checkout is private/local QA. `package.json` is marked private, so packing
the plugin does not authorize npm publication or a public catalog entry.

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

## Reproducible local package

The plugin has no third-party runtime Python or Node dependencies. `uv.lock` is
the shipped and checked project lockfile: keep it beside `pyproject.toml`, and
run `uv lock --check` after changing project metadata. It must ship in the
package because the Docker build runs `uv sync --locked`; do not replace it with
an unpinned `pip install` path. The PEP 517 build backend is pinned separately
to `setuptools==80.9.0` because build-system requirements are not recorded as
project runtime dependencies in `uv.lock`. The Docker base images are pinned
by digest in `Dockerfile`; update those digests deliberately with the
corresponding third-party notice.

From this directory, the offline package checks are:

```sh
qa_dir="$(mktemp -d /tmp/eztudy-plugin.XXXXXX)"
trap 'rm -rf "$qa_dir"' EXIT
uv lock --check
npm run verify
npm pack --ignore-scripts --pack-destination "$qa_dir"
```

`npm run verify` checks the Python contract, the package allowlist, the exact
manifest versions, the packed file list, and the absence of generated state.
Inspect the resulting tarball and install it through the Ez manager with the
SHA-256 returned by `ez plugins inspect`; a successful pack or container health
check alone is not runtime acceptance.

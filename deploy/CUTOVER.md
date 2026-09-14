# Deployment and cutover runbook

Use an isolated Compose project, hostname, API/relay ports, MongoDB database, Ez
state directory, and application registration for a release candidate. The plugin
package ID remains `eztudy`; install it only inside the isolated staging Ez
installation because Ez does not provide install-time aliases. Never install a candidate over a working
instance or point it at production data for its first run.

## Release evidence

Record the source tag and commit, built image digests, exact Ez revision, CI result,
configuration schema, and rollback target. Keep credentials, machine paths, account
identifiers, native sessions, and learner data in a private operator record—not in
the repository, issue, pull request, or release notes.

On staging, verify:

1. API and Ez health checks succeed from their real network boundaries.
2. The allowlisted owner signs in, reloads, signs out, and signs back in to the same
   canonical account and tenant.
3. Two related Coach messages preserve native context and survive a page reload.
4. A native agent authors Markdown, uses the installed Eztudy CLI, receives a
   revision-matching receipt, and the authenticated UI renders that exact revision.
5. Cross-account reads, writes, run access, and cancellation are denied before any
   multi-account deployment is claimed.

Set unique `COMPOSE_PROJECT_NAME`, `API_PORT`, `RELAY_PORT`, `EZ_STATE_DIR`,
`API_IMAGE`, and `EZ_RUNTIME_IMAGE` values for staging. Use the exact Ez revision
recorded by the release; do not substitute a locally convenient image.

## Data decision

Before replacing an existing service, explicitly choose one of these paths:

- migrate compatible legacy records with a reviewed, dry-run-capable migration and
  before/after counts; or
- start a new canonical database and accept that legacy accounts, content, and chat
  history will not appear in the new application.

Take and restore-test a database snapshot before either path. Preserve the prior
application image, database, Ez state, frontend deployment, and reverse-proxy route
until the new instance passes post-cutover readback.

## Cutover and rollback

Deploy the immutable frontend with `VITE_API_BASE_URL` set to the staged API origin,
then switch the public reverse-proxy/domain route only after the authenticated gate
passes. Re-run health, sign-in, Coach, publication, and visible revision checks on
the public origin.

Rollback restores the previous frontend deployment and proxy route. If any migration
wrote production data, use its reviewed reversal or restore the tested snapshot;
never improvise a destructive rollback against the only copy.

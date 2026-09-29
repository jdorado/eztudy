# Deploy the learning app

The frontend and canonical API work without a Coach connection. Build the
current API from this repository; a healthy legacy service is not a compatible
backend. The frontend requires `POST /api/account` and `GET /api/content`.

For an API-only deployment, keep the existing canonical MongoDB database and
Privy app/owner configuration in a private environment file. Set
`EZTUDY_CORS_ORIGINS` to the exact frontend origin. Then run:

```sh
COMPOSE_PROJECT_NAME=ezstudy-app API_IMAGE=ezstudy-api:YOUR_COMMIT \
  API_ENV_FILE=/private/api.env API_PORT=8111 \
  docker compose -f deploy/compose.api.yaml up -d --build --wait
```

Terminate HTTPS at the reverse proxy and route the frontend's configured
`VITE_API_BASE_URL` to this API. Before switching a live route, verify
`GET /api/health` returns 200, unauthenticated `POST /api/account` returns 401
(not 404), and the frontend origin passes the CORS preflight. Then verify an
authenticated sign-in and the expected published Items after reload. Preserve
the prior route/image for rollback. See the [cutover runbook](CUTOVER.md).

This Compose file does not provision Ez, mount its private state, or enable
Coach. Use the optional integration below when a Coach connection is wanted.

## Standard Ez owner chat and plugins

Use an Ez revision containing channel-independent owner registration and the
standard application-command wrapper. Build its ordinary `runtime` Docker target
in the Ez repository and pin the resulting image by commit. `EZ_IMAGE` selects
that image; Eztudy's Dockerfile installs only the pinned native engine binary.
No Ez source copies, `npm link`, control-state edits or runtime patches belong here.
The current pin is [Ez commit f75b966](https://github.com/jdorado/ez-agents/commit/f75b966).
In that exact Ez checkout run
`docker build --target runtime -t ez-agents:f75b966 .` before building this image.

Copy `.env.example` to `.env.local`, set a private absolute `EZ_STATE_DIR` and the
reviewed `EZ_IMAGE`, and create private `workspace`, `control` and `home` directories.
Run the native engine through Ez's standard host executor, with Node, Docker,
Compose and the authenticated native CLI installed on the host. The relay uses
`EZ_EXECUTOR_TRANSPORT=host`; no Docker socket belongs in its container. Never
mount the backend's account registry or service token into a running agent.

Install the same pinned Ez package on the host. Create `host-executor.json` in
the private state directory using Ez's standard binding:

```json
{"cli":"codex","agents":[{"name":"eztudy","workspace":"/private/eztudy/workspace","controlDir":"/private/eztudy/control","binDir":"/absolute/ez-package/bin"}]}
```

Substitute real absolute paths. Ez's deployment convention calls the workspace
`mind`; when retaining an existing `workspace` directory, create a `mind` symlink
to it. Preserve the existing `control/cli/codex` sessions and ensure its login
file resolves on the host. Initialize the registry before starting the host:

```sh
node /absolute/ez-package/bin/ezenciel-agents-tools.mjs init \
  --home /private/eztudy/tools --workspace /private/eztudy/workspace \
  --host-config /private/eztudy/host-executor.json
```

Register the package's `bin/ezenciel-agents-host` using its documented macOS
LaunchAgent or Linux user service, with `EZ_DEPLOYMENT_DIR` set to the private
state directory. Verify the host heartbeat before starting the relay below.
The host executor and relay share the same control directory; the native engine
retains its own sessions. Ask the agent through Coach to install the reviewed
[Eztudy plugin](../plugin/README.md), then configure its scoped connection.

As the installing administrator, create a random private channel token and use
Ez's installed command with the installation's `EZ_CONTROL_DIR`:

```sh
ezenciel-agents-application --owner-id VERIFIED_ACCOUNT_ID --id eztudy \
  --token-file /private/application-token --share-owner
```

`VERIFIED_ACCOUNT_ID` comes from Eztudy's authenticated canonical account, never
the browser request body. For an existing Ez owner, omit `--owner-id` and record
that owner's ID in the server-owned mapping. Ez's bearer-authenticated
`GET /v1/registration` supplies the binding ID; do not calculate or copy it.

Set API `EZ_BINDINGS_FILE` to a private registry outside the agent's mounts:

```json
{"version":1,"bindings":[{"principalId":"VERIFIED_ACCOUNT_ID","ownerId":"EZ_OWNER_ID","url":"http://relay:8787","tokenFile":"/run/secrets/ez-tokens/application-token"}]}
```

Use HTTPS across hosts. This Compose configuration publishes only loopback for
local QA; the API reaches the relay only through its exact private Compose service
name and container port. Each independent account requires its own isolated installation.

```sh
docker compose --env-file .env.local build relay
docker compose --env-file .env.local up -d --wait relay
```

The same Compose file can build and run the API. Copy `api.env.example` to a
private file outside the repository, set `API_ENV_FILE`, `EZ_BINDINGS_FILE`, and
`EZ_TOKEN_DIR` in
`.env.local`, then run `docker compose --env-file .env.local up -d --build --wait`.
Terminate TLS in a reverse proxy, expose only the proxy, and set the frontend's
`VITE_API_BASE_URL` and API's exact `EZTUDY_CORS_ORIGINS` to the public origins.
Configure exactly one intended Privy subject. Set `API_UID` and
`API_GID` to the owner of the binding and token files; those files must be regular,
non-symlink files with no group/world permission bits.

The API verifies Privy and Ez registration, forwards literal text using
`followOwner:true`, and reads Ez's replies live, including native scheduled
replies; it keeps no transcript. It never schedules work or selects a native
session. Repeated admission reuses its request key and the opaque run ID from Ez.

Additional trusted channels register separate tokens against the same owner.
Rotate a token with `--rotate` to preserve bindings and native continuity. Telegram
uses Ez's observed pairing/approval and unlink commands. Phone and other providers
need their own authenticated adapters; adding their registration is not a phone
service. Eztudy's self-service linking UI is not part of the 0.1 release.

When replacing an existing installation, stop its executor and preserve its complete
state. Do not rewrite orphaned authority files. Register an isolated installation,
copy only its own native engine history, and use Ez's documented
`--import-scope ... --native-session ... --cli codex --share-owner` command to
preserve owner-chat continuity. Keep the previous state until QA passes.

Gate: two related authenticated messages produce contextual replies in the FE;
reload retains them. No Telegram dependency, duplicate execution, second runner
or app-specific scheduler. Follow the [cutover runbook](CUTOVER.md) before changing
a live domain or database.

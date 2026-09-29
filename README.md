# Eztudy

Eztudy is a small, self-hostable learning application. It combines a responsive
React interface, a canonical FastAPI/MongoDB data service, Privy authentication,
and agent execution through [Ez](https://github.com/jdorado/ez-agents).

This baseline supports authenticated owner chat, Markdown Program publication,
flat ordered Markdown and linked video/podcast/movie Items, canonical Program
selection, and publication receipts. It is
deliberately an invite-only release: automatic tenant provisioning,
open public registration, account deletion/export, storage quotas, media hosting,
and broad public multi-tenant assurance are not included.

## Architecture

- `web/` presents authenticated application state; it owns no learner identity,
  durable content, or agent runtime.
- `api/` verifies Privy tokens and owns canonical accounts, tenant mappings,
  Programs, and publication receipts in MongoDB; chat runs live in Ez.
- `plugin/` reads published Programs and validates/publishes agent-authored Markdown.
- Ez admits application turns and transports controls and results. The native
  engine owns reasoning, context, sessions, tools, goals, and delegation.

See the [architecture contract](docs/ez-eztudy-architecture-contract.md),
[publishing contract](docs/item-publishing-spec.md), and
[self-hosting guide](deploy/README.md).

## Local development

Requires Node.js 22+, Yarn, pnpm 10, Python 3.11+, uv, and MongoDB. Reuse the
shared local MongoDB at `mongodb://localhost:27017`. Create a Privy app
with Google login enabled and allow `http://localhost:5175` as an origin.

```sh
cp api/.env.example api/.env.local
cp web/.env.example web/.env.local
# Configure both files. Set EZTUDY_ALLOWED_SUBJECTS to the approved Privy subjects.
cd web && pnpm install --frozen-lockfile && cd ..
yarn dev
```

`yarn dev` starts the API and web hot reload together and stops both when you
exit. Open `http://localhost:5175`. Vite proxies `/api` to the local service. A returning
account reuses the same server-owned account and tenant mapping. Every other
subject is rejected. Each approved subject has a distinct tenant and Ez binding.

## Frontend deployment

For Vercel, connect the repository with `web` as the project Root Directory and
configure `VITE_PRIVY_APP_ID` plus the HTTPS `VITE_API_BASE_URL` for Production.
Keep those values in deployment settings, never in the repository. Treat a
successful build as incomplete until the matching API and authenticated user path
have been verified on the public origin.

## Verification

```sh
cd web && pnpm build && pnpm audit --audit-level high
cd ../api && uv run --env-file .env.local python -m unittest discover -s tests -v
cd ../plugin && npm pack --dry-run
```

Code checks are not release acceptance. Use the short
[local smoke stories](docs/qa-smoke-stories.md) for agent-facing changes.
Authentication changes need a real
sign-in/refresh/sign-out/sign-in path. Chat and publication changes need a real Ez
receipt and an authenticated frontend readback. Deployment changes need an isolated
staging installation, exact revisions, backup/rollback proof, and a post-cutover
readback.

## Operations and safety

Configuration examples contain placeholders only. Never commit `.env` files,
MongoDB data, learner content, Ez/native sessions, publication credentials, or
deployment state. Read [`DATA_HANDLING.md`](DATA_HANDLING.md) before inviting users
and report vulnerabilities through [`SECURITY.md`](SECURITY.md).

Project-owned source is MIT licensed. Dependencies retain their own terms; web
redistributors must review [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md),
including the non-MIT terms present in the current Privy dependency graph.

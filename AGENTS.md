# [REPO CODE] EzStudy

Build a small, easy-to-edit learning app in public. `app/` is the product; the
old Eztudy code is remote-only archive material, not an implementation path.

## Ownership

- `web/` is the removable frontend for chat, publishing, and following content.
- `api/` owns verified identity, tenant isolation, canonical learner/content data,
  and deterministic operations. Never trust browser-supplied identity or store
  canonical learner state in the browser.
- Ez owns reasoning, sessions, context, execution, and transport. Every tenant
  gets its own Ez deployment, workspace, and Markdown context.
- The installed `plugin/` CLI is the agent's only EzStudy read/write path. Keep
  it small and deterministic; the channel only authenticates, transports, and
  renders. Agent-authored Markdown stays in the agent workspace until published
  through the plugin. Do not mirror agent state or build a second agent runtime.

Read `docs/ez-eztudy-architecture-contract.md` before changing these boundaries.
Keep credentials, learner data, sessions, and local deployment state out of git.

## Fast local loop

- Work directly on `main`. Make the smallest useful change, run one focused
  check, and use `pnpm dev` for quick QA. Preserve other work, then commit and
  push `main`.
- Skip new tests for routine UI, copy, and reversible changes. Add one focused
  regression test for a subtle publishing rule, tenant boundary, or recurring
  bug. Use the real authenticated flow and canonical readback for agent-facing
  changes; run the agent through the local Ez container and installed plugin.
- Public/open-source is the default for product code. Keep private config and
  user data outside the repo. Deploy only when requested separately.

Run `pnpm dev` from this directory for local API and web hot reload. See
`README.md` for the one-time environment setup.

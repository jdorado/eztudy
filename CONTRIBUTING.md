# Contributing

Keep changes small and preserve the ownership boundaries in
[`docs/ez-eztudy-architecture-contract.md`](docs/ez-eztudy-architecture-contract.md).
The web app presents state, the API owns identity and canonical application data,
Ez admits agent work, and the native engine owns reasoning, context, tools, and
sessions. Eztudy must not grow a second agent runner.

Before opening a pull request:

1. Do not add credentials, personal learner data, native sessions, receipts, or
   local deployment state.
2. Run `pnpm build` and `pnpm audit --audit-level high` in `web/`.
3. Run `uv run python -m unittest discover -s tests -v` in `api/` after
   `uv sync --locked`.
4. Describe the user-visible path you exercised. Authentication or deployment
   changes require a real signed-in path on an isolated test installation.
5. State any data migration, security, licensing, or rollback consequence.

Report security concerns privately as described in [`SECURITY.md`](SECURITY.md).


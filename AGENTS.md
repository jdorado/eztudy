# Eztudy

Read docs/ez-eztudy-architecture-contract.md before structural changes.
Keep changes as one small, reviewable capability at a time.

- web/ owns the responsive UI; api/ owns canonical identity and app data.
- All agent turns belong to Ez and its native engine. No app-owned runner.
- Agent application actions use the Eztudy plugin/CLI when that slice is built.
- No auth bypass, hardcoded identity, browser learner state or demo account data.
- Preserve the current visual direction; keep components and API contracts small.
- Use relevant build checks and one real authenticated user-path QA per slice.
- Stop at the requested QA gate. Do not expand into later capabilities automatically.
- Consume Ez as-is. Each step adds only its requested capability. If integration requires changing Ez behavior, flag the conflict before implementing; never silently restrict capabilities or add app-specific runtime workarounds.
- Never commit credentials, learner data, native sessions or local deployment state.

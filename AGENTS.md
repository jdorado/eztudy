# Eztudy

Read docs/ez-eztudy-architecture-contract.md before structural changes.

- web/ owns the responsive UI; api/ owns canonical identity and app data.
- No auth bypass, hardcoded identity, browser learner state or demo account data.
- Preserve the current visual direction; keep components and API contracts small.
- Never commit credentials, learner data, native sessions or local deployment state.

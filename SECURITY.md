# Security policy

Please do not open a public issue for a suspected vulnerability or include live
credentials, learner data, access tokens, deployment paths, or exploit details in
a pull request. Use GitHub's private vulnerability reporting for this repository.

Only the latest tagged release is supported. A report should identify the affected
version, impact, and a minimal reproduction that contains no real user data. The
maintainer will acknowledge a report within seven days and coordinate disclosure
after a fix is available.

Self-hosters are responsible for TLS termination, MongoDB access controls and
backups, private Ez/plugin state, secret-file permissions, Privy origin settings,
and setting exactly one intended `EZTUDY_ALLOWED_SUBJECT`.

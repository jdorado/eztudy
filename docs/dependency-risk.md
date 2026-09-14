# Dependency risk record

Reviewed: 2026-09-14 for the 0.1 release candidate.

`pnpm audit --prod` reports zero critical/high findings and three moderate
instances from the Privy wallet dependency graph:

- `uuid` versions used below wallet integration packages have a missing buffer
  bounds check in name-based UUID APIs.
- `decode-uri-component` below a wallet integration package can consume excessive
  resources on malformed percent-encoded input.

Eztudy enables Google login only and configures Privy to disable external and
embedded wallet creation/UI. The application does not call those affected UUID
buffer or wallet URI paths. The moderate findings are accepted for this controlled
single-owner release while Privy owns the transitive graph; they must be re-audited
on every dependency update and before broader public hosting. A high or critical
finding fails CI.

The same graph includes non-MIT MetaMask and WalletConnect/Reown terms. Required
notices and exact locked license texts are shipped in the web build and summarized
in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md). Replacing the React auth
package with a narrower authentication-only client is a future dependency-reduction
slice, not an unverified release-time rewrite.

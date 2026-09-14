# Third-party notices

The MIT license in [`LICENSE`](LICENSE) applies only to Eztudy's project-owned
source code. Dependencies retain their own licenses and terms.

The web application uses `@privy-io/react-auth`. Its dependency graph currently
includes MetaMask SDK and WalletConnect/Reown components even though wallet UI is
disabled. The following required notices therefore apply to distributed web builds:

- MetaMask SDK is copyright ConsenSys Software Inc. Its bundled license restricts
  use to the defined Non-Commercial Use and requires a prominent notice. Review
  the bundled [`@metamask/sdk` license](docs/licenses/METAMASK-SDK-LICENSE.txt)
  before distribution or commercial use.
- Portions © 2025 Reown, Inc. All Rights Reserved. The locked graph includes
  components under three distinct texts: the WalletKit community agreement,
  the AppKit 1.8.9 community agreement, and Apache-2.0 for AppKit 1.7.8. Preserve
  and review the exact copies in
  [`docs/licenses/WALLETCONNECT-COMMUNITY-LICENSE.md`](docs/licenses/WALLETCONNECT-COMMUNITY-LICENSE.md),
  [`docs/licenses/REOWN-APPKIT-1.8.9-LICENSE.md`](docs/licenses/REOWN-APPKIT-1.8.9-LICENSE.md),
  and [`docs/licenses/REOWN-APPKIT-1.7.8-LICENSE.txt`](docs/licenses/REOWN-APPKIT-1.7.8-LICENSE.txt).

This notice is not legal advice. Operators and redistributors must review the
licenses installed for the exact locked dependency versions and preserve all
required license texts and attributions. See the current
[dependency risk record](docs/dependency-risk.md) for the separately assessed
security-advisory surface.

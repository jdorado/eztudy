# Third-party notices

The Eztudy publisher runtime uses only the Python standard library. It has no
third-party Python or Node runtime dependencies, and it does not bundle learner
data, credentials, native sessions, or another service runtime.

The following tools are used to build the local package and its container:

- `setuptools==80.9.0` is the PEP 517 build backend and is build-time only.
  It is distributed under the MIT License; see the
  [upstream license](https://github.com/pypa/setuptools/blob/main/LICENSE).
- `uv 0.11.15` is copied from its pinned Docker image and creates the locked
  environment. It is dual-licensed under MIT and Apache-2.0; see its
  [MIT license](https://github.com/astral-sh/uv/blob/main/LICENSE-MIT) and
  [Apache-2.0 license](https://github.com/astral-sh/uv/blob/main/LICENSE-APACHE).
- The Docker base images `python:3.12-slim-trixie@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9`
  and `ghcr.io/astral-sh/uv:0.11.15@sha256:e590846f4776907b254ac0f44b5b380347af5d90d668138ca7938d1b0c2f98d3`
  are pulled at build time and are not included in the npm tarball. Their
  Python, Debian and uv notices remain the responsibility of the image
  distributions; see the
  [uv container source](https://github.com/astral-sh/uv) and
  [Python image licensing information](https://github.com/docker-library/python).

No upstream `NOTICE` file is required by the source/runtime dependencies above.
This file is included in the reviewed plugin package so local installers retain
the applicable attribution and license pointers.

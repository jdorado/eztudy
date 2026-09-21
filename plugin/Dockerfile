FROM python:3.12-slim-trixie@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9 AS publisher
COPY --from=ghcr.io/astral-sh/uv:0.11.15@sha256:e590846f4776907b254ac0f44b5b380347af5d90d668138ca7938d1b0c2f98d3 /uv /uvx /bin/
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
COPY pyproject.toml uv.lock README.md LICENSE THIRD_PARTY_NOTICES.md ./
COPY eztudy_publishing ./eztudy_publishing
RUN uv sync --locked --no-dev --no-editable \
    && mkdir -p /state \
    && chown 1000:1000 /state
USER 1000:1000
CMD ["sleep", "infinity"]

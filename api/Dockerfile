FROM python:3.12.12-slim-bookworm@sha256:593bd06efe90efa80dc4eee3948be7c0fde4134606dd40d8dd8dbcade98e669c

ARG UV_VERSION=0.11.15
RUN pip install --no-cache-dir "uv==${UV_VERSION}" \
    && addgroup --system eztudy \
    && adduser --system --ingroup eztudy --home /nonexistent --no-create-home eztudy

WORKDIR /workspace/api
COPY plugin /workspace/plugin
COPY api /workspace/api
RUN uv sync --frozen --no-dev \
    && chown -R eztudy:eztudy /workspace/api/.venv

ENV PATH=/workspace/api/.venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
USER eztudy
EXPOSE 8111
CMD ["uvicorn", "eztudy_api.main:app", "--host", "0.0.0.0", "--port", "8111", "--proxy-headers", "--forwarded-allow-ips=127.0.0.1"]


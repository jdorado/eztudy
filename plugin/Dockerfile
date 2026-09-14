FROM python:3.12-slim AS publisher
WORKDIR /app
COPY pyproject.toml ./
COPY eztudy_publishing ./eztudy_publishing
RUN pip install --no-cache-dir . && mkdir -p /state && chown 1000:1000 /state
USER 1000:1000
CMD ["sleep", "infinity"]

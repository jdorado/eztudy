#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for env_file in "$APP_DIR/api/.env.local" "$APP_DIR/web/.env.local"; do
  if [[ ! -f "$env_file" ]]; then
    echo "Missing $env_file; copy the matching .env.example and configure it." >&2
    exit 1
  fi
done

if [[ ! -d "$APP_DIR/web/node_modules" ]]; then
  echo "Install web dependencies first: cd web && pnpm install --frozen-lockfile" >&2
  exit 1
fi

cd "$APP_DIR/api"
uv run --locked --env-file .env.local python -m uvicorn eztudy_api.main:app --host 127.0.0.1 --port 8111 --reload &
api_pid=$!

cd "$APP_DIR/web"
./node_modules/.bin/vite --host 127.0.0.1 --port 5175 --strictPort &
web_pid=$!

cleanup() {
  trap - EXIT INT TERM
  kill "$api_pid" "$web_pid" 2>/dev/null || true
  wait "$api_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "EzStudy local: http://localhost:5175 (API: http://127.0.0.1:8111)"
while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 1
done
echo "A local server stopped; shutting down the other." >&2
exit 1

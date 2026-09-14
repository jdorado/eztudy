#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for forbidden in \
  docs/open-source-build-checklist.md \
  docs/product-operating-notes.md \
  docs/program-publication-contract.md \
  docs/step-4a-review.md \
  docs/step-4bc-review.md; do
  if [[ -e "$forbidden" ]]; then
    echo "Private planning file is present: $forbidden" >&2
    exit 1
  fi
done

if rg -n \
  --hidden \
  --glob '!.git/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/.venv/**' \
  --glob '!**/dist/**' \
  --glob '!scripts/check-public-release.sh' \
  '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-(live|proj)-[A-Za-z0-9_-]{12,}|mongodb(\+srv)?://[^[:space:]]+:[^[:space:]@]+@|/Users/[^/]+/|@gmail\.com)' .; then
  echo "Possible private or secret material found." >&2
  exit 1
fi

git diff --check

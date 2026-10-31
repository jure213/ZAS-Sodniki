#!/usr/bin/env bash
# Generates a new PGRST_JWT_SECRET, stores it in .env and in the database, and
# restarts PostgREST. Every issued token (including any leaked one) stops
# working; all users have to log in again.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
cd "$PROJECT_DIR"

if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

NEW_SECRET="$(head -c 48 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')"
TMP="$(mktemp "$ENV_FILE.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

if grep -qE '^PGRST_JWT_SECRET=' "$ENV_FILE"; then
  sed -E "s|^PGRST_JWT_SECRET=.*$|PGRST_JWT_SECRET=$NEW_SECRET|" "$ENV_FILE" > "$TMP"
else
  cat "$ENV_FILE" > "$TMP"
  echo "PGRST_JWT_SECRET=$NEW_SECRET" >> "$TMP"
fi
chmod 600 "$TMP"
cp -p "$ENV_FILE" "$ENV_FILE.bak"
mv "$TMP" "$ENV_FILE"
trap - EXIT

ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/migrate.sh"
"${COMPOSE[@]}" up -d api

echo "JWT secret rotated. Previous .env saved as $ENV_FILE.bak (delete it once everything works)."

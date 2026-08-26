#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
DUMP_DIR="$PROJECT_DIR/deploy/dumps"
REPLACE=false

if [[ "${1:-}" == "--replace" ]]; then
  REPLACE=true
  shift
fi

DUMP_ARG="${1:-}"
if [[ -z "$DUMP_ARG" ]]; then
  echo "Usage: $0 [--replace] deploy/dumps/<archive.dump>" >&2
  exit 1
fi

DUMP_PATH="$(realpath -- "$DUMP_ARG")"
case "$DUMP_PATH" in
  "$DUMP_DIR"/*.dump) ;;
  *) echo "The archive must be a .dump file inside $DUMP_DIR" >&2; exit 1 ;;
esac

if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump not found: $DUMP_PATH" >&2
  exit 1
fi

cd "$PROJECT_DIR"
if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

"${COMPOSE[@]}" exec -T db pg_restore --list "/migrations/$(basename "$DUMP_PATH")" >/dev/null

TABLE_COUNT="$("${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")"
if [[ "$TABLE_COUNT" != "0" && "$REPLACE" != "true" ]]; then
  echo "Target contains $TABLE_COUNT public tables. Re-run with --replace only after confirming the archive." >&2
  exit 1
fi

if [[ "$REPLACE" == "true" ]]; then
  read -r -p "Type REPLACE zas_sodniki to overwrite the target database: " CONFIRMATION
  if [[ "$CONFIRMATION" != "REPLACE zas_sodniki" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

RESTORE_LIST="$DUMP_DIR/.restore-list"
"${COMPOSE[@]}" exec -T db pg_restore --list "/migrations/$(basename "$DUMP_PATH")" \
  | sed -E '/ (POLICY|ROW SECURITY) /d' > "$RESTORE_LIST"

echo "Restoring schema and data..."
"${COMPOSE[@]}" exec -T db pg_restore \
  --username=zas_sodniki_admin \
  --dbname=zas_sodniki \
  --clean --if-exists --exit-on-error --no-owner --no-privileges \
  --use-list=/migrations/.restore-list \
  "/migrations/$(basename "$DUMP_PATH")"

"${COMPOSE[@]}" exec -T db psql \
  --username=zas_sodniki_admin --dbname=zas_sodniki \
  < "$PROJECT_DIR/deploy/sql/grant-api.sql"

rm -f "$RESTORE_LIST"
echo "Restore completed and API grants refreshed."

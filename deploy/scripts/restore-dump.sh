#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
DUMP_DIR="$PROJECT_DIR/deploy/dumps"
REPLACE=false
MIGRATE=true

while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --replace) REPLACE=true ;;
    # Restore the archive as it is: skip migrate.sh. Used to roll back to a
    # backup that predates a migration (see DEPLOYMENT.md, section 8). The API
    # stays unusable until the matching version of migrate.sh has been run.
    --no-migrate) MIGRATE=false ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

DUMP_ARG="${1:-}"
if [[ -z "$DUMP_ARG" ]]; then
  echo "Usage: $0 [--replace] [--no-migrate] deploy/dumps/<archive.dump>" >&2
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

"${COMPOSE[@]}" exec -T db pg_restore --list "/migrations/$(basename "$DUMP_PATH")" </dev/null >/dev/null

TABLE_COUNT="$("${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';" </dev/null)"
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

if [[ "$REPLACE" == "true" ]]; then
  # Forget migration state and drop everything the archive may not know about.
  # Without this, restoring an older archive would leave schema_migrations
  # claiming changes the restored tables lack, and pg_restore --clean would fail
  # on tables and views that only exist in the newer schema (for example
  # payment_transactions and the views that depend on payments).
  # migrate.sh re-applies whatever the archive lacks (migrations are idempotent).
  "${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
    -v ON_ERROR_STOP=1 -c "SET client_min_messages = warning; DROP SCHEMA IF EXISTS private CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION pg_database_owner; REVOKE ALL ON SCHEMA public FROM PUBLIC;"
fi

echo "Restoring schema and data..."
"${COMPOSE[@]}" exec -T db pg_restore \
  --username=zas_sodniki_admin \
  --dbname=zas_sodniki \
  --clean --if-exists --exit-on-error --no-owner --no-privileges \
  --use-list=/migrations/.restore-list \
  "/migrations/$(basename "$DUMP_PATH")"

rm -f "$RESTORE_LIST"

if [[ "$MIGRATE" != "true" ]]; then
  echo "Restore completed WITHOUT migrations (--no-migrate). The API does not work until the"
  echo "migrate.sh that matches this archive has been run."
  exit 0
fi

# Applies pending migrations, recreates API roles and grants, and restores the
# JWT signing secret (backups deliberately do not contain it).
"$SCRIPT_DIR/migrate.sh"
echo "Restore completed, migrations applied and API grants refreshed."

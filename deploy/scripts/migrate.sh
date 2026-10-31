#!/usr/bin/env bash
# Applies pending deploy/sql/NNN_*.sql migrations (each in one transaction),
# then refreshes API grants and the JWT signing secret stored in the database.
# Safe to run repeatedly.
#
#   ./deploy/scripts/migrate.sh            apply pending migrations
#   ./deploy/scripts/migrate.sh --status   list applied / pending migrations
#
# ENV_FILE may point to a different .env (default: <project>/.env).
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
SQL_DIR="$PROJECT_DIR/deploy/sql"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
STATUS_ONLY=false
[[ "${1:-}" == "--status" ]] && STATUS_ONLY=true

cd "$PROJECT_DIR"
if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

psql_db() {
  "${COMPOSE[@]}" exec -T -e PGOPTIONS='-c client_min_messages=warning' db psql --no-psqlrc --quiet \
    --set ON_ERROR_STOP=1 --username=zas_sodniki_admin --dbname=zas_sodniki "$@"
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi
JWT_SECRET="$(grep -E '^PGRST_JWT_SECRET=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
if [[ ! "$JWT_SECRET" =~ ^[A-Za-z0-9_-]{32,}$ ]]; then
  echo "PGRST_JWT_SECRET in $ENV_FILE is missing or not a base64url string of 32+ chars." >&2
  exit 1
fi

if ! psql_db -Atc "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'" | grep -q 1; then
  echo "public.users does not exist. Restore a dump first (deploy/scripts/restore-dump.sh)." >&2
  exit 1
fi

psql_db < "$SQL_DIR/roles.sql"

psql_db <<'SQL'
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS private.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

APPLIED="$(psql_db -Atc "SELECT version FROM private.schema_migrations ORDER BY version")"

shopt -s nullglob
PENDING=()
for file in "$SQL_DIR"/[0-9][0-9][0-9]_*.sql; do
  version="$(basename "$file" .sql)"
  # 000_baseline documents the schema that existed before migrations.
  [[ "$version" == 000_* ]] && continue
  if grep -qxF "$version" <<<"$APPLIED"; then
    $STATUS_ONLY && echo "applied  $version"
  else
    $STATUS_ONLY && echo "pending  $version"
    PENDING+=("$file")
  fi
done
$STATUS_ONLY && exit 0

for file in "${PENDING[@]}"; do
  version="$(basename "$file" .sql)"
  echo "Applying $version..."
  {
    cat "$file"
    printf "\nINSERT INTO private.schema_migrations (version) VALUES ('%s');\n" "$version"
  } | psql_db --single-transaction
done

echo "Refreshing API grants..."
psql_db < "$SQL_DIR/grant-api.sql"

echo "Syncing JWT signing secret..."
# The secret is validated as base64url above, so it is safe to inline. It goes
# through stdin, not the command line, so it never shows up in `ps`.
printf "INSERT INTO private.config (key, value) VALUES ('jwt_secret', '%s')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\n" "$JWT_SECRET" | psql_db

echo "Database is up to date (${#PENDING[@]} migration(s) applied)."

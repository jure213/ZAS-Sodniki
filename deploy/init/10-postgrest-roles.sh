#!/usr/bin/env bash
# Runs once, when the database volume is first created. Creates the login role
# PostgREST connects with. The API roles (zas_anon, zas_user, zas_admin) and
# their privileges are created by deploy/scripts/migrate.sh after a restore.
set -euo pipefail

if [[ -z "${POSTGREST_DB_PASSWORD:-}" ]]; then
  echo "POSTGREST_DB_PASSWORD is required" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set postgrest_password="$POSTGREST_DB_PASSWORD" <<'SQL'
CREATE ROLE postgrest_authenticator LOGIN NOINHERIT PASSWORD :'postgrest_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

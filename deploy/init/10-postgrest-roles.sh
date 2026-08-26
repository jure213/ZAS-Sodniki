#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${POSTGREST_DB_PASSWORD:-}" ]]; then
  echo "POSTGREST_DB_PASSWORD is required" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set postgrest_password="$POSTGREST_DB_PASSWORD" <<'SQL'
CREATE ROLE zas_sodniki_api NOLOGIN BYPASSRLS;
CREATE ROLE postgrest_authenticator LOGIN NOINHERIT PASSWORD :'postgrest_password';
GRANT zas_sodniki_api TO postgrest_authenticator;

ALTER ROLE zas_sodniki_api SET statement_timeout = '20s';
ALTER ROLE zas_sodniki_api SET idle_in_transaction_session_timeout = '20s';

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO zas_sodniki_api;
SQL

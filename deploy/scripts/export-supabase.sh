#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
DUMP_DIR="$PROJECT_DIR/deploy/dumps"
PG_IMAGE="postgres:17.11-bookworm"

mkdir -p "$DUMP_DIR"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi

read -r -p "Supabase database host: " SOURCE_HOST
read -r -p "Port [5432]: " SOURCE_PORT
SOURCE_PORT="${SOURCE_PORT:-5432}"
read -r -p "Database [postgres]: " SOURCE_DATABASE
SOURCE_DATABASE="${SOURCE_DATABASE:-postgres}"
read -r -p "Username [postgres]: " SOURCE_USER
SOURCE_USER="${SOURCE_USER:-postgres}"
read -r -s -p "Database password: " SOURCE_PASSWORD
echo

if [[ -z "$SOURCE_HOST" || -z "$SOURCE_PASSWORD" ]]; then
  echo "Host and password are required." >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_NAME="zas-sodniki-supabase-$STAMP.dump"
META_NAME="zas-sodniki-supabase-$STAMP.metadata.txt"

COMMON_ENV=(
  --env "PGHOST=$SOURCE_HOST"
  --env "PGPORT=$SOURCE_PORT"
  --env "PGDATABASE=$SOURCE_DATABASE"
  --env "PGUSER=$SOURCE_USER"
  --env "PGPASSWORD=$SOURCE_PASSWORD"
  --env "PGSSLMODE=require"
)

echo "Reading source metadata..."
"${DOCKER[@]}" run --rm "${COMMON_ENV[@]}" "$PG_IMAGE" \
  psql --no-psqlrc --tuples-only --no-align \
  --command "SELECT 'server_version=' || current_setting('server_version'); SELECT 'extension=' || extname FROM pg_extension ORDER BY extname; SELECT table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text FROM (VALUES ('users'), ('officials'), ('competitions'), ('competition_officials'), ('payments'), ('settings')) AS required_tables(table_name);" \
  > "$DUMP_DIR/$META_NAME"

echo "Creating a portable public-schema archive..."
"${DOCKER[@]}" run --rm \
  --user "$(id -u):$(id -g)" \
  "${COMMON_ENV[@]}" \
  --volume "$DUMP_DIR:/dumps" \
  "$PG_IMAGE" \
  pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  --schema=public --file="/dumps/$DUMP_NAME"

unset SOURCE_PASSWORD

"${DOCKER[@]}" run --rm --user "$(id -u):$(id -g)" \
  --volume "$DUMP_DIR:/dumps" "$PG_IMAGE" \
  pg_restore --list "/dumps/$DUMP_NAME" >/dev/null

sha256sum "$DUMP_DIR/$DUMP_NAME" > "$DUMP_DIR/$DUMP_NAME.sha256"
chmod 600 "$DUMP_DIR/$DUMP_NAME" "$DUMP_DIR/$DUMP_NAME.sha256" "$DUMP_DIR/$META_NAME"

echo "Export verified: $DUMP_DIR/$DUMP_NAME"
echo "Metadata:        $DUMP_DIR/$META_NAME"
echo "Checksum:        $DUMP_DIR/$DUMP_NAME.sha256"

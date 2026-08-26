#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/deploy/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_PATH="$BACKUP_DIR/zas-sodniki-$STAMP.dump"
TEMP_PATH="$FINAL_PATH.partial"

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

trap 'rm -f "$TEMP_PATH"' EXIT
"${COMPOSE[@]}" exec -T db pg_dump \
  --username=zas_sodniki_admin --dbname=zas_sodniki \
  --format=custom --compress=9 --no-owner --no-privileges \
  > "$TEMP_PATH"

"${COMPOSE[@]}" exec -T db pg_restore --list >/dev/null < "$TEMP_PATH"
mv "$TEMP_PATH" "$FINAL_PATH"
sha256sum "$FINAL_PATH" > "$FINAL_PATH.sha256"
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'zas-sodniki-*.dump' -o -name 'zas-sodniki-*.dump.sha256' \) \
  -mtime +56 -delete

echo "Backup verified: $FINAL_PATH"

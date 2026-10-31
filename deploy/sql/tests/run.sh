#!/usr/bin/env bash
# Runs the SQL tests against the LOCAL stack (never against production: the
# tests create rows, but every test ends with ROLLBACK).
#
#   ./deploy/sql/tests/run.sh            all tests
#   ./deploy/sql/tests/run.sh 030        only tests whose file name starts with 030
#
# Uses the current docker compose project (honours COMPOSE_FILE etc.).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if docker info >/dev/null 2>&1; then COMPOSE=(docker compose); else COMPOSE=(sudo docker compose); fi
psql_db() {
  "${COMPOSE[@]}" exec -T -e PGOPTIONS='-c client_min_messages=warning' db \
    psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 -U zas_sodniki_admin -d zas_sodniki "$@"
}

failed=0
count=0
for t in [0-9][0-9][0-9]_*.sql; do
  [[ -n "${1:-}" && "$t" != "$1"* ]] && continue
  count=$((count + 1))
  if out="$(cat _fixture.sql "$t" | psql_db 2>&1)"; then
    echo "PASS  $t"
  else
    echo "FAIL  $t"
    echo "$out" | sed 's/^/        /'
    failed=$((failed + 1))
  fi
done
echo "$((count - failed))/$count test files passed."
[[ $failed -eq 0 ]]

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Run node scripts/generate-deploy-env.js first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

ZAS_API_URL="${ZAS_API_URL:-https://sodniki-api.jurer.eu}"

if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

"${COMPOSE[@]}" ps
"${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
  -c "SELECT 'users' AS table_name, count(*) FROM public.users UNION ALL SELECT 'officials', count(*) FROM public.officials UNION ALL SELECT 'competitions', count(*) FROM public.competitions UNION ALL SELECT 'competition_officials', count(*) FROM public.competition_officials UNION ALL SELECT 'payments', count(*) FROM public.payments UNION ALL SELECT 'settings', count(*) FROM public.settings ORDER BY table_name;"
"${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
  -c "SELECT version, applied_at FROM private.schema_migrations ORDER BY version;"

fail() { echo "FAIL: $*" >&2; exit 1; }

# Without a token, data must be unreachable.
code="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$ZAS_API_URL/rest/v1/officials?select=id&limit=1")"
[[ "$code" == "401" ]] || fail "anonymous read of officials returned HTTP $code (expected 401)"

# The legacy shared key must no longer work, if it is still in .env.
if [[ -n "${ZAS_API_KEY:-}" && "$ZAS_API_KEY" != generate_with_* ]]; then
  code="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --header "Authorization: Bearer $ZAS_API_KEY" \
    "$ZAS_API_URL/rest/v1/officials?select=id&limit=1")"
  [[ "$code" == "401" ]] || fail "legacy ZAS_API_KEY still accepted (HTTP $code)"
fi

# login() must be reachable and reject bad credentials with a null body.
body="$(curl --silent --show-error --fail \
  --header 'Content-Type: application/json' \
  --data '{"username":"__verify_nonexistent__","password":"x"}' \
  "$ZAS_API_URL/rest/v1/rpc/login")"
[[ "$body" == "null" ]] || fail "login with bad credentials returned: $body"

echo "Database and public API checks passed."

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

# ENV_FILE may point to a different .env (default: <project>/.env), like migrate.sh.
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Run node scripts/generate-deploy-env.js first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ZAS_API_URL="${ZAS_API_URL:-https://sodniki-api.jurer.eu}"
# nginx maps /rest/v1/ to PostgREST; set ZAS_API_PREFIX="" to talk to PostgREST directly.
API="$ZAS_API_URL${ZAS_API_PREFIX-/rest/v1}"
# curl.exe on Windows (Git Bash) cannot write to /dev/null.
DEVNULL=/dev/null
[[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] && DEVNULL=NUL

if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

"${COMPOSE[@]}" ps
"${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
  -c "SELECT 'users' AS table_name, count(*) FROM public.users UNION ALL SELECT 'officials', count(*) FROM public.officials UNION ALL SELECT 'competitions', count(*) FROM public.competitions UNION ALL SELECT 'competition_officials', count(*) FROM public.competition_officials UNION ALL SELECT 'payments', count(*) FROM public.payments UNION ALL SELECT 'payment_transactions', count(*) FROM public.payment_transactions ORDER BY table_name;"
"${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
  -c "SELECT version, applied_at FROM private.schema_migrations ORDER BY version;"

fail() { echo "FAIL: $*" >&2; exit 1; }

# Without a token, data must be unreachable.
code="$(curl --silent --output "$DEVNULL" --write-out '%{http_code}' \
  "$API/officials?select=id&limit=1")"
[[ "$code" == "401" ]] || fail "anonymous read of officials returned HTTP $code (expected 401)"

# The legacy shared key must no longer work, if it is still in .env.
if [[ -n "${ZAS_API_KEY:-}" && "$ZAS_API_KEY" != generate_with_* ]]; then
  code="$(curl --silent --output "$DEVNULL" --write-out '%{http_code}' \
    --header "Authorization: Bearer $ZAS_API_KEY" \
    "$API/officials?select=id&limit=1")"
  [[ "$code" == "401" ]] || fail "legacy ZAS_API_KEY still accepted (HTTP $code)"
fi

# login() must be reachable and reject bad credentials with a null body.
body="$(curl --silent --show-error --fail \
  --header 'Content-Type: application/json' \
  --data '{"username":"__verify_nonexistent__","password":"x"}' \
  "$API/rpc/login")"
[[ "$body" == "null" ]] || fail "login with bad credentials returned: $body"

# ---------------------------------------------------------------------------
# Privilege checks for the v2 data model (migration 002). The tokens are signed
# by the database for existing users and live for 60 seconds, so no password is
# needed. Set ZAS_API_PREFIX="" when the API is reached without the nginx
# /rest/v1 prefix (for example a local PostgREST on 127.0.0.1:8081).
# ---------------------------------------------------------------------------
psql_q() { "${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki -Atq "$@"; }

if [[ "$(psql_q -c "SELECT to_regclass('public.payment_transactions') IS NOT NULL")" == "t" ]]; then
  token_for() { # token_for <app role>: 60-second token of the first user with that role, or empty
    psql_q -c "SELECT private.sign_jwt(jsonb_build_object('role', private.db_role(role), 'user_id', id,
                 'iat', floor(extract(epoch FROM now())), 'exp', floor(extract(epoch FROM now())) + 60))
               FROM public.users WHERE role = '$1' ORDER BY id LIMIT 1"
  }
  http() { # http <token|-> <method> <path> [json body] -> status code
    local token="$1" method="$2" path="$3" body="${4:-}"
    local args=(--silent --output "$DEVNULL" --write-out '%{http_code}' --request "$method" --header 'Content-Type: application/json')
    [[ "$token" != "-" ]] && args+=(--header "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    curl "${args[@]}" "$API$path"
  }
  expect() { # expect <label> <wanted codes, space separated> <got>
    [[ " $2 " == *" $3 "* ]] || fail "$1: HTTP $3 (expected $2)"
  }

  # Anonymous: no view, table or function of the new model is reachable.
  for path in payment_balances assignment_details payment_transactions roles role_rates disciplines app_config; do
    expect "anonymous GET /$path" "401" "$(http - GET "/$path?limit=1")"
  done
  expect "anonymous dashboard_stats" "401" "$(http - POST /rpc/dashboard_stats '{}')"

  admin_token="$(token_for admin)"
  user_token="$(token_for user)"
  [[ -n "$admin_token" ]] || fail "no admin user to test with"

  # Admin: may read, may call the functions, may NOT write guarded tables directly.
  expect "admin GET payment_balances" "200" "$(http "$admin_token" GET "/payment_balances?limit=1")"
  expect "admin dashboard_stats" "200" "$(http "$admin_token" POST /rpc/dashboard_stats '{}')"
  expect "admin record_payment reachable (validation error for amount 0)" "400"     "$(http "$admin_token" POST /rpc/record_payment '{"payment_id":-1,"amount":0}')"
  expect "admin POST payment_transactions" "403"     "$(http "$admin_token" POST /payment_transactions '{"payment_id":-1,"amount":1,"paid_on":"2000-01-01","method":"gotovina"}')"
  expect "admin DELETE payment_transactions" "403" "$(http "$admin_token" DELETE "/payment_transactions?id=eq.-1")"
  expect "admin PATCH role_rates" "403" "$(http "$admin_token" PATCH "/role_rates?id=eq.-1" '{"rate":0}')"
  expect "admin POST roles" "403" "$(http "$admin_token" POST /roles '{"name":"__verify__"}')"
  expect "admin POST payments" "403" "$(http "$admin_token" POST /payments '{"amount_due":1,"tariff":"sodnik"}')"
  expect "retired settings table is gone" "404" "$(http "$admin_token" GET "/settings?limit=1")"

  # Normal user: read-only.
  if [[ -n "$user_token" ]]; then
    expect "user GET payment_balances" "200" "$(http "$user_token" GET "/payment_balances?limit=1")"
    expect "user dashboard_stats" "200" "$(http "$user_token" POST /rpc/dashboard_stats '{}')"
    expect "user record_payment" "403" "$(http "$user_token" POST /rpc/record_payment '{"payment_id":-1,"amount":1}')"
    expect "user generate_payments" "403" "$(http "$user_token" POST /rpc/generate_payments '{"competition_id":-1}')"
    expect "user save_role" "403" "$(http "$user_token" POST /rpc/save_role '{"id":null,"name":"__verify__"}')"
    expect "user PATCH officials" "403" "$(http "$user_token" PATCH "/officials?id=eq.-1" '{"name":"x"}')"
  else
    echo "NOTE: no user with role 'user'; skipped the read-only user checks."
  fi
fi

echo "Database and public API checks passed."

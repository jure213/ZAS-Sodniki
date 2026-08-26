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

if docker info >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(sudo docker compose)
fi

"${COMPOSE[@]}" ps
"${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
"${COMPOSE[@]}" exec -T db psql -U zas_sodniki_admin -d zas_sodniki \
  -c "SELECT 'users' AS table_name, count(*) FROM public.users UNION ALL SELECT 'officials', count(*) FROM public.officials UNION ALL SELECT 'competitions', count(*) FROM public.competitions UNION ALL SELECT 'competition_officials', count(*) FROM public.competition_officials UNION ALL SELECT 'payments', count(*) FROM public.payments UNION ALL SELECT 'settings', count(*) FROM public.settings ORDER BY table_name;"

curl --fail --silent --show-error \
  --header "apikey: $ZAS_API_KEY" \
  --header "Authorization: Bearer $ZAS_API_KEY" \
  "$ZAS_API_URL/rest/v1/officials?select=id&limit=1" \
  --output /dev/null

echo "Database and public API checks passed."

# Source this from the repo root:  source deploy/rehearsal/env.sh
#
# Points docker compose and the deploy scripts at the throwaway rehearsal stack
# instead of the repo's own .env / docker-compose.yml, and creates
# deploy/rehearsal/.env with fresh random secrets on first use.
#
# Why the exports matter: the deploy scripts run from the repo root, and docker
# compose would otherwise read the repo's own .env for ${...} values. Values
# exported in the shell win, so the stack and migrate.sh agree on one set of
# secrets. Run only on your own PC, never on the VPS.
_rh_dir="$(pwd)/deploy/rehearsal"
if [[ ! -f "$_rh_dir/docker-compose.yml" ]]; then
  echo "Run 'source deploy/rehearsal/env.sh' from the repository root." >&2
  return 1
fi
if [[ ! -f "$_rh_dir/.env" ]]; then
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
    echo "POSTGREST_DB_PASSWORD=$(openssl rand -hex 16)"
    echo "PGRST_JWT_SECRET=$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')"
  } > "$_rh_dir/.env"
  echo "Created deploy/rehearsal/.env (gitignored)."
fi
export MSYS_NO_PATHCONV=1                      # Git Bash: keep /paths intact in docker exec
_rh_win="$(pwd -W 2>/dev/null || pwd)"         # Git Bash needs C:/... for docker compose
export COMPOSE_PROJECT_NAME="${REHEARSAL_PROJECT:-zas-rehearsal}"
export COMPOSE_FILE="$_rh_win/deploy/rehearsal/docker-compose.yml"
export ENV_FILE="$_rh_win/deploy/rehearsal/.env"
set -a; . "$_rh_dir/.env"; set +a
unset _rh_dir _rh_win
echo "Rehearsal stack: project=$COMPOSE_PROJECT_NAME  api=127.0.0.1:${REHEARSAL_API_PORT:-8081}  nginx=127.0.0.1:${REHEARSAL_PORT:-8082}"

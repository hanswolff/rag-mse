#!/bin/bash
# Deployment script for RAG Schießsport MSE
set -euo pipefail

trap 'echo "Deployment failed." >&2' ERR

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ -f "$PROJECT_DIR/.env" ]; then
  HAS_DEV_DEPLOYMENT_OVERRIDE=0
  OVERRIDE_DEVELOPMENT_DEPLOYMENT=""
  if [ "${DEVELOPMENT_DEPLOYMENT+x}" = "x" ]; then
    HAS_DEV_DEPLOYMENT_OVERRIDE=1
    OVERRIDE_DEVELOPMENT_DEPLOYMENT="$DEVELOPMENT_DEPLOYMENT"
  fi

  set -a
  . "$PROJECT_DIR/.env"
  set +a

  if [ "$HAS_DEV_DEPLOYMENT_OVERRIDE" -eq 1 ]; then
    export DEVELOPMENT_DEPLOYMENT="$OVERRIDE_DEVELOPMENT_DEPLOYMENT"
  fi
fi

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" != "22" ]; then
  echo "Deployment requires Node.js 22.x. Current: $(node -v)" >&2
  exit 1
fi

if [ "${DEVELOPMENT_DEPLOYMENT:-false}" = "true" ]; then
  DEPLOYMENT_MODE="development"
  echo "Development deployment mode enabled (DEVELOPMENT_DEPLOYMENT=true)."
else
  DEPLOYMENT_MODE="production"
  echo "Production deployment mode enabled."
fi

# Next.js build/start require production mode semantics.
# Deployment mode is controlled separately by DEVELOPMENT_DEPLOYMENT.
export NODE_ENV="production"
echo "Using NODE_ENV=production for build and runtime compatibility."

echo "Running deployment preflight checks..."
APP_RUNTIME_UID="${APP_UID:-1000}"
APP_RUNTIME_GID="${APP_GID:-1000}"

if [[ ! "$APP_RUNTIME_UID" =~ ^[1-9][0-9]*$ ]]; then
  echo "Deployment failed: invalid runtime UID '$APP_RUNTIME_UID' from APP_UID." >&2
  exit 1
fi

if [[ ! "$APP_RUNTIME_GID" =~ ^[1-9][0-9]*$ ]]; then
  echo "Deployment failed: invalid runtime GID '$APP_RUNTIME_GID' from APP_GID." >&2
  exit 1
fi

mkdir -p "$PROJECT_DIR/data"
echo "Checking write permissions for ./data with user ${APP_RUNTIME_UID}:${APP_RUNTIME_GID}..."
if ! docker run --rm \
  --user "${APP_RUNTIME_UID}:${APP_RUNTIME_GID}" \
  -v "$PROJECT_DIR/data:/data:rw" \
  alpine:3.20 \
  sh -lc 'touch /data/.rag-mse-write-test && rm -f /data/.rag-mse-write-test' >/dev/null 2>&1; then
  DATA_OWNER="$(stat -c '%u:%g' "$PROJECT_DIR/data" 2>/dev/null || echo unknown)"
  echo "Deployment failed: ./data is not writable for runtime user ${APP_RUNTIME_UID}:${APP_RUNTIME_GID}." >&2
  echo "Current ./data owner: $DATA_OWNER" >&2
  echo "Recommended fix: chown -R ${APP_RUNTIME_UID}:${APP_RUNTIME_GID} \"$PROJECT_DIR/data\"" >&2
  exit 1
fi

LOG_FILE="$(mktemp -t rag-mse-deploy-XXXXXX.log)"
cleanup() {
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

wait_for_service_health() {
  local service_name="$1"
  local expected_status="${2:-healthy}"
  local max_attempts="${3:-20}"
  local attempt=1
  local container_id
  local service_status=""

  container_id="$(docker compose ps -q "$service_name" | head -n 1)"
  if [ -z "${container_id:-}" ]; then
    echo "Deployment failed: container for service '$service_name' not found." >&2
    docker compose ps >&2 || true
    exit 1
  fi

  while [ "$attempt" -le "$max_attempts" ]; do
    service_status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [ "$service_status" = "$expected_status" ]; then
      return 0
    fi
    if [ "$service_status" = "unhealthy" ] || [ "$service_status" = "restarting" ] || [ "$service_status" = "exited" ]; then
      echo "Deployment failed: service '$service_name' status is '$service_status'." >&2
      docker compose logs --no-color --tail=150 "$service_name" >&2 || true
      exit 1
    fi
    sleep 3
    attempt=$((attempt + 1))
  done

  echo "Deployment failed: service '$service_name' did not reach '$expected_status' in time (last status: '$service_status')." >&2
  docker compose logs --no-color --tail=150 "$service_name" >&2 || true
  exit 1
}

echo "Installing dependencies on host..."
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install --frozen-lockfile --force

echo "Rebuilding native modules for current Node runtime..."
pnpm rebuild better-sqlite3

echo "Generating Prisma client..."
pnpm exec prisma generate

echo "Building Next.js app on host..."
pnpm run build

PREV_APP_CONTAINER_ID="$(docker compose ps -q app | head -n 1)"

echo "Building app container image..."
set +e
docker compose build app 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Deployment failed during app image build. Existing running containers were not intentionally stopped." >&2
  exit "$status"
fi

echo "Ensuring dependent services are running..."
docker compose up -d redis 2>&1 | tee -a "$LOG_FILE"
echo "Waiting for redis to become healthy..."
wait_for_service_health "redis" "healthy" 20

echo "Recreating app container with latest image..."
set +e
docker compose up -d --no-deps --force-recreate app 2>&1 | tee -a "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Deployment failed during app container recreate. Existing running containers were not intentionally stopped." >&2
  exit "$status"
fi

echo "Waiting for app container to become healthy..."
APP_CONTAINER_ID="$(docker compose ps -q app | head -n 1)"
if [ -z "${APP_CONTAINER_ID:-}" ]; then
  echo "Deployment failed: app container for service 'app' not found." >&2
  docker compose ps >&2 || true
  exit 1
fi

if [ -n "${PREV_APP_CONTAINER_ID:-}" ] && [ "$APP_CONTAINER_ID" = "$PREV_APP_CONTAINER_ID" ]; then
  echo "Deployment failed: app container was not recreated (container ID unchanged)." >&2
  exit 1
fi

wait_for_service_health "app" "healthy" 20

echo "Running post-deploy CSP smoke check..."
node "$PROJECT_DIR/scripts/check-csp-smoke.js" "http://127.0.0.1:3000/"

echo "Cleaning up unused Docker images..."
docker image prune -f >/dev/null

echo "Deployment completed successfully!"

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

echo "Building and starting containers..."
set +e
docker compose up --build -d 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Deployment failed during container build/start. Existing running containers were not intentionally stopped." >&2
  exit "$status"
fi

if ! docker compose ps --services --filter status=running | grep -q .; then
  echo "Deployment failed: no running services after startup." >&2
  exit 1
fi

echo "Waiting for app container to become healthy..."
max_attempts=20
attempt=1
APP_CONTAINER_ID="$(docker compose ps -q app | head -n 1)"
if [ -z "${APP_CONTAINER_ID:-}" ]; then
  echo "Deployment failed: app container for service 'app' not found." >&2
  docker compose ps >&2 || true
  exit 1
fi

while [ "$attempt" -le "$max_attempts" ]; do
  app_status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$APP_CONTAINER_ID" 2>/dev/null || true)"
  if [ "$app_status" = "healthy" ]; then
    break
  fi
  if [ "$app_status" = "unhealthy" ] || [ "$app_status" = "restarting" ] || [ "$app_status" = "exited" ]; then
    echo "Deployment failed: app container status is '$app_status'." >&2
    docker compose logs --no-color --tail=150 app >&2 || true
    exit 1
  fi
  sleep 3
  attempt=$((attempt + 1))
done

if [ "$app_status" != "healthy" ]; then
  echo "Deployment failed: app container did not become healthy in time (last status: '$app_status')." >&2
  docker compose logs --no-color --tail=150 app >&2 || true
  exit 1
fi

echo "Cleaning up unused Docker images..."
docker image prune -f >/dev/null

echo "Deployment completed successfully!"

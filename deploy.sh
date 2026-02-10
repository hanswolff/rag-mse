#!/bin/bash
# Deployment script for RAG Schießsport MSE
set -euo pipefail

trap 'echo "Deployment failed." >&2' ERR

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" != "22" ]; then
  echo "Deployment requires Node.js 22.x. Current: $(node -v)" >&2
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
while [ "$attempt" -le "$max_attempts" ]; do
  app_status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' rag-mse-app 2>/dev/null || true)"
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

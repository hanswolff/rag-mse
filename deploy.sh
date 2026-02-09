#!/bin/bash
# Deployment script for RAG Schießsport MSE
set -euo pipefail

trap 'echo "Deployment failed." >&2' ERR

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

LOG_FILE="$(mktemp -t rag-mse-deploy-XXXXXX.log)"
cleanup() {
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

echo "Installing dependencies on host..."
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install --frozen-lockfile

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

echo "Cleaning up unused Docker images..."
docker image prune -f >/dev/null

echo "Deployment completed successfully!"

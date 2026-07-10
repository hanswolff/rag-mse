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
if ! podman run --rm \
  --userns=keep-id \
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
NEXT_BUILD_BACKUP_DIR=""
DEPLOY_SUCCEEDED=0
cleanup() {
  rm -f "$LOG_FILE"

  if [ -n "$NEXT_BUILD_BACKUP_DIR" ] && [ -d "$NEXT_BUILD_BACKUP_DIR/.next" ]; then
    if [ "$DEPLOY_SUCCEEDED" -eq 1 ]; then
      rm -rf "$NEXT_BUILD_BACKUP_DIR"
    else
      # Fehlgeschlagenes Deployment: vorherige Build-Artefakte wiederherstellen,
      # damit der Host-Zustand zum (zurückgerollten) laufenden Stand passt.
      echo "Restoring previous .next build artifacts from $NEXT_BUILD_BACKUP_DIR..." >&2
      rm -rf "$PROJECT_DIR/.next"
      mv "$NEXT_BUILD_BACKUP_DIR/.next" "$PROJECT_DIR/.next"
      rm -rf "$NEXT_BUILD_BACKUP_DIR"
    fi
  fi
}
trap cleanup EXIT

resolve_host_sqlite_path() {
  local database_url="$1"
  local raw_path=""

  if [ -z "$database_url" ] || [[ "$database_url" != file:* ]]; then
    return 1
  fi

  raw_path="${database_url#file:}"
  if [ -z "$raw_path" ]; then
    return 1
  fi

  if [[ "$raw_path" = /app/* ]]; then
    printf '%s\n' "$PROJECT_DIR/${raw_path#/app/}"
    return 0
  fi

  if [[ "$raw_path" = /* ]]; then
    printf '%s\n' "$raw_path"
    return 0
  fi

  printf '%s\n' "$PROJECT_DIR/${raw_path#./}"
}

wait_for_service_health() {
  local service_name="$1"
  local expected_status="${2:-healthy}"
  local max_attempts="${3:-20}"
  local attempt=1
  local container_id
  local service_status=""

  # podman-compose `ps` has no service-name positional (unlike docker compose);
  # this is a single-service project, so list project containers and take the first.
  container_id="$(podman-compose ps -q | head -n 1)"
  if [ -z "${container_id:-}" ]; then
    echo "Health check failed: container for service '$service_name' not found." >&2
    podman-compose ps >&2 || true
    return 1
  fi

  while [ "$attempt" -le "$max_attempts" ]; do
    service_status="$(podman inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [ "$service_status" = "$expected_status" ]; then
      return 0
    fi
    # Healthcheck aktiv ausführen: rootless Podman braucht für die Timer eine
    # funktionierende systemd-User-Instanz; ohne sie bliebe der Status ewig "starting".
    if [ "$service_status" = "starting" ]; then
      podman healthcheck run "$container_id" >/dev/null 2>&1 || true
      service_status="$(podman inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      if [ "$service_status" = "$expected_status" ]; then
        return 0
      fi
    fi
    if [ "$service_status" = "unhealthy" ] || [ "$service_status" = "restarting" ] || [ "$service_status" = "exited" ]; then
      echo "Health check failed: service '$service_name' status is '$service_status'." >&2
      podman-compose logs --tail=150 "$service_name" >&2 || true
      return 1
    fi
    sleep 3
    attempt=$((attempt + 1))
  done

  echo "Health check failed: service '$service_name' did not reach '$expected_status' in time (last status: '$service_status')." >&2
  podman-compose logs --tail=150 "$service_name" >&2 || true
  return 1
}

# Automatischer Rollback: DB-Backup zurückspielen (Migrationen des neuen Stands
# rückgängig machen) und den Container wieder mit dem vorherigen Image starten.
rollback_deployment() {
  echo "Rolling back deployment..." >&2

  podman-compose stop app >&2 || true

  if [ -n "${BACKUP_FILE:-}" ] && [ -f "$BACKUP_FILE" ] && [ -n "${DB_FILE:-}" ]; then
    echo "Restoring pre-deploy database backup: $BACKUP_FILE" >&2
    cp "$BACKUP_FILE" "$DB_FILE"
    rm -f "$DB_FILE-wal" "$DB_FILE-shm"
  else
    echo "No pre-deploy database backup to restore." >&2
  fi

  if [ -n "${PREV_IMAGE_ID:-}" ] && [ -n "${PREV_IMAGE_NAME:-}" ]; then
    echo "Restoring previous app image ($PREV_IMAGE_NAME -> $PREV_IMAGE_ID)..." >&2
    podman tag "$PREV_IMAGE_ID" "$PREV_IMAGE_NAME" >&2 || true
    podman-compose up -d --no-deps --force-recreate app >&2 || true

    if wait_for_service_health "app" "healthy" 20; then
      echo "Rollback succeeded: previous version is running again." >&2
    else
      echo "ROLLBACK FAILED: previous version did not become healthy. Manual intervention required." >&2
      echo "Database backup (already restored): ${BACKUP_FILE:-none}" >&2
    fi
  else
    echo "No previous image available (first deployment?); container remains stopped." >&2
    echo "Database backup (already restored): ${BACKUP_FILE:-none}" >&2
  fi
}

echo "Installing dependencies on host..."
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install --frozen-lockfile --force

echo "Rebuilding native modules for current Node runtime..."
pnpm rebuild better-sqlite3

echo "Generating Prisma client..."
pnpm exec prisma generate

echo "Building runtime scripts..."
pnpm run build:scripts

if [ -d "$PROJECT_DIR/.next" ]; then
  NEXT_BUILD_BACKUP_DIR="$(mktemp -d -t rag-mse-next-build-XXXXXX)"
  echo "Moving existing .next build artifacts to $NEXT_BUILD_BACKUP_DIR before rebuilding..."
  mv "$PROJECT_DIR/.next" "$NEXT_BUILD_BACKUP_DIR/.next"
fi

echo "Building Next.js app on host..."
pnpm run build

echo "Creating pre-deploy database backup..."
DB_FILE=""
if DB_FILE="$(resolve_host_sqlite_path "${DATABASE_URL:-}")" && [ -f "$DB_FILE" ]; then
  BACKUP_DIR="./data/backups"
  BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d_%H%M%S).db"
  mkdir -p "$BACKUP_DIR"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".timeout 5000" ".backup '$BACKUP_FILE'"
  else
    cp "$DB_FILE" "$BACKUP_FILE"
  fi
  echo "✅ Pre-deploy backup: $BACKUP_FILE"

  # Aufbewahrungsgrenze: nur die letzten 10 Pre-Deploy-Backups behalten
  PRE_DEPLOY_KEEP=10
  ls -1t "$BACKUP_DIR"/pre-deploy-*.db 2>/dev/null | tail -n "+$((PRE_DEPLOY_KEEP + 1))" | while IFS= read -r OLD_BACKUP; do
    echo "Removing old pre-deploy backup: $OLD_BACKUP"
    rm -f "$OLD_BACKUP"
  done
else
  echo "⚠️  No database file found at '${DB_FILE:-<DATABASE_URL not set>}' on host, skipping backup."
fi

PREV_APP_CONTAINER_ID="$(podman-compose ps -q | head -n 1)"
PREV_IMAGE_ID=""
PREV_IMAGE_NAME=""
if [ -n "${PREV_APP_CONTAINER_ID:-}" ]; then
  PREV_IMAGE_ID="$(podman inspect --format '{{.Image}}' "$PREV_APP_CONTAINER_ID" 2>/dev/null || true)"
  PREV_IMAGE_NAME="$(podman inspect --format '{{.ImageName}}' "$PREV_APP_CONTAINER_ID" 2>/dev/null || true)"
fi

echo "Building app container image..."
set +e
podman-compose build app 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Deployment failed during app image build. Existing running containers were not intentionally stopped." >&2
  exit "$status"
fi

echo "Recreating app container with latest image..."
set +e
podman-compose up -d --no-deps --force-recreate app 2>&1 | tee -a "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Deployment failed during app container recreate. Existing running containers were not intentionally stopped." >&2
  exit "$status"
fi

echo "Waiting for app container to become healthy..."
APP_CONTAINER_ID="$(podman-compose ps -q | head -n 1)"
if [ -z "${APP_CONTAINER_ID:-}" ]; then
  echo "Deployment failed: app container for service 'app' not found." >&2
  podman-compose ps >&2 || true
  exit 1
fi

if [ -n "${PREV_APP_CONTAINER_ID:-}" ] && [ "$APP_CONTAINER_ID" = "$PREV_APP_CONTAINER_ID" ]; then
  echo "Deployment failed: app container was not recreated (container ID unchanged)." >&2
  exit 1
fi

if ! wait_for_service_health "app" "healthy" 20; then
  echo "Deployment failed: new app container did not become healthy (e.g. failed migration)." >&2
  rollback_deployment
  exit 1
fi

echo "Running post-deploy CSP smoke check..."
if ! node "$PROJECT_DIR/scripts/check-csp-smoke.js" "http://127.0.0.1:3000/"; then
  echo "Deployment failed: CSP smoke check failed." >&2
  rollback_deployment
  exit 1
fi

echo "Cleaning up unused Podman images..."
podman image prune -f >/dev/null

DEPLOY_SUCCEEDED=1
echo "Deployment completed successfully!"

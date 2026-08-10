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

# Die Produktions-DB heißt prod.db; eine dev.db-URL aus einer veralteten .env
# würde die einmalige Umbenennung im Entrypoint stillschweigend überspringen
# und das nächtliche Backup (zielt fest auf prod.db) dauerhaft fehlschlagen lassen.
if [ "$(basename "${DATABASE_URL:-file:./data/prod.db}")" = "dev.db" ]; then
  echo "Deployment failed: DATABASE_URL points to dev.db ('${DATABASE_URL}')." >&2
  echo "The production database is prod.db. Update DATABASE_URL in .env (see .env.example)." >&2
  exit 1
fi

# Der Entrypoint verweigert den Start, wenn im Datenverzeichnis prod.db UND die
# historische dev.db liegen — dann ist unklar, welche Datei die echten Daten hält.
# Ohne diese Vorabprüfung fällt das erst nach allen Gates, Image-Build und
# Container-Wechsel auf: Der neue Container wird nie healthy, deploy.sh rollt zurück,
# und ein kompletter Zyklus (~25 min) plus Downtime ist verloren. Eine vergessene,
# meist leere dev.db aus einem Prisma-Aufruf reicht dafür aus.
HOST_DATA_DIR="$PROJECT_DIR/data"
if [ -f "$HOST_DATA_DIR/prod.db" ] && [ -f "$HOST_DATA_DIR/dev.db" ]; then
  echo "Deployment failed: both $HOST_DATA_DIR/prod.db and legacy $HOST_DATA_DIR/dev.db exist." >&2
  echo "The container entrypoint refuses to start in this state." >&2
  echo "Check which file holds the real data, e.g.:" >&2
  echo "  sqlite3 $HOST_DATA_DIR/dev.db 'select count(*) from sqlite_master;'" >&2
  echo "Then archive the obsolete one out of the data directory, e.g.:" >&2
  echo "  mv $HOST_DATA_DIR/dev.db $PROJECT_DIR/backups/stale-dev.db-\$(date +%Y%m%d)" >&2
  exit 1
fi

# A systemd unit that owns the same compose project breaks every deploy: an
# attached `podman-compose up` (Type=simple) exits as soon as this script stops
# or force-recreates the app container, systemd then fires its ExecStop
# `podman-compose down` and deletes the container plus network mid-deploy.
# Abort instead of taking the site down.
if command -v systemctl >/dev/null 2>&1 &&
   systemctl --user list-unit-files rag-mse.service 2>/dev/null | grep -q '^rag-mse.service'; then
  echo "Deployment failed: conflicting systemd user unit rag-mse.service found." >&2
  echo "It fights this script for ownership of the container and causes outages mid-deploy." >&2
  echo "Remove it first:" >&2
  echo "  systemctl --user disable --now rag-mse.service" >&2
  echo "  rm ~/.config/systemd/user/rag-mse.service && systemctl --user daemon-reload" >&2
  echo "Boot persistence is covered by podman-restart.service + restart: unless-stopped." >&2
  exit 1
fi

# `restart: unless-stopped` in compose.yaml only survives a reboot if
# podman-restart.service is enabled for this user and lingering is on (rootless
# Podman has no always-on daemon). Warn instead of failing: a deploy is still
# valid, the stack just would not come back by itself after a reboot.
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl --user is-enabled podman-restart.service >/dev/null 2>&1; then
    echo "Warning: podman-restart.service is not enabled - the stack will NOT survive a reboot." >&2
    echo "  Fix: systemctl --user enable --now podman-restart.service" >&2
  fi
  if command -v loginctl >/dev/null 2>&1 &&
     [ "$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null)" != "yes" ]; then
    echo "Warning: lingering is not enabled for $(id -un) - user services do not start before first login." >&2
    echo "  Fix: loginctl enable-linger $(id -un)" >&2
  fi
fi

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
SMOKE_CONTAINER_NAME=""
SMOKE_DATA_DIR=""
cleanup_smoke_container() {
  if [ -n "$SMOKE_CONTAINER_NAME" ]; then
    podman rm -f "$SMOKE_CONTAINER_NAME" >/dev/null 2>&1 || true
    SMOKE_CONTAINER_NAME=""
  fi
  if [ -n "$SMOKE_DATA_DIR" ] && [ -d "$SMOKE_DATA_DIR" ]; then
    rm -rf "$SMOKE_DATA_DIR"
    SMOKE_DATA_DIR=""
  fi
}
SELFTEST_RESPONSE_FILE=""
SELFTEST_HEADER_FILE=""
cleanup() {
  rm -f "$LOG_FILE" "$SELFTEST_RESPONSE_FILE" "$SELFTEST_HEADER_FILE"
  cleanup_smoke_container

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
# Bash führt den EXIT-Trap bei SIGINT (Ctrl-C) nicht aus; über den exit-Pfad
# läuft cleanup() trotzdem — sonst blieben Smoke-Container und Temp-Dateien liegen.
trap 'exit 130' INT

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

# Automatischer Rollback. Modus "with-db-restore" spielt zusätzlich das
# Pre-Deploy-DB-Backup zurück — NUR gerechtfertigt, solange der neue Container
# nie healthy war (keine Benutzer-Schreibzugriffe seit dem Backup, das direkt
# vor dem Container-Stopp erstellt wurde). Nach erfolgreichem Healthcheck darf
# die DB nicht mehr angefasst werden: Ein Restore würde bereits angenommene
# Benutzeraktionen stillschweigend verwerfen (Modus "image-only").
rollback_deployment() {
  local mode="${1:-image-only}"
  echo "Rolling back deployment (mode: $mode)..." >&2

  podman-compose stop app >&2 || true

  if [ "$mode" = "with-db-restore" ]; then
    if [ -n "${BACKUP_FILE:-}" ] && [ -f "$BACKUP_FILE" ] && [ -n "${DB_FILE:-}" ]; then
      echo "Restoring pre-deploy database backup: $BACKUP_FILE" >&2
      cp "$BACKUP_FILE" "$DB_FILE"
      rm -f "$DB_FILE-wal" "$DB_FILE-shm"
      if [ -f "$BACKUP_FILE-wal" ]; then cp "$BACKUP_FILE-wal" "$DB_FILE-wal"; fi
    else
      echo "No pre-deploy database backup to restore." >&2
    fi
  else
    echo "Keeping current database (no restore in mode '$mode')." >&2
  fi

  if [ -n "${PREV_IMAGE_ID:-}" ] && [ -n "${PREV_IMAGE_NAME:-}" ]; then
    echo "Restoring previous app image ($PREV_IMAGE_NAME -> $PREV_IMAGE_ID)..." >&2
    podman tag "$PREV_IMAGE_ID" "$PREV_IMAGE_NAME" >&2 || true
    podman-compose up -d --no-deps --force-recreate app >&2 || true

    if wait_for_service_health "app" "healthy" 20; then
      echo "Rollback succeeded: previous version is running again." >&2
    else
      echo "ROLLBACK FAILED: previous version did not become healthy. Manual intervention required." >&2
      echo "Pre-deploy database backup: ${BACKUP_FILE:-none}" >&2
    fi
  else
    echo "No previous image available (first deployment?); container remains stopped." >&2
    echo "Pre-deploy database backup: ${BACKUP_FILE:-none}" >&2
  fi
}

# Post-Deploy-Gate: /api/selftest prüft Datenbank, Migrationen, Stammdaten und
# E-Mail-Warteschlange in der laufenden App (docs/SELFTEST.md). Läuft erst nach
# erfolgreichem Healthcheck; bei Fehlern gilt daher ADR 0008: nur "image-only"-
# Rollback, die Datenbank bleibt unangetastet.
run_post_deploy_selftest() {
  local selftest_url="http://127.0.0.1:3000/api/selftest"

  if [ -z "${SELFTEST_TOKEN:-}" ]; then
    echo "⚠️  SELFTEST_TOKEN is not set - skipping post-deploy selftest ($selftest_url)." >&2
    echo "   Set SELFTEST_TOKEN in .env to enable this gate (docs/SELFTEST.md)." >&2
    return 0
  fi

  # Beide Temp-Dateien hängen am EXIT-Cleanup; der Token wandert über eine
  # 0600-Datei statt über die per ps/procfs einsehbare curl-Kommandozeile.
  local response_file http_status
  SELFTEST_RESPONSE_FILE="$(mktemp -t rag-mse-selftest-XXXXXX.json)"
  SELFTEST_HEADER_FILE="$(mktemp -t rag-mse-selftest-hdr-XXXXXX)"
  response_file="$SELFTEST_RESPONSE_FILE"
  chmod 600 "$SELFTEST_HEADER_FILE"
  printf 'Authorization: Bearer %s\n' "$SELFTEST_TOKEN" > "$SELFTEST_HEADER_FILE"
  http_status="$(curl -sS --max-time 90 -o "$response_file" -w '%{http_code}' \
    -H @"$SELFTEST_HEADER_FILE" \
    "$selftest_url")" || http_status="000"
  rm -f "$SELFTEST_HEADER_FILE"
  SELFTEST_HEADER_FILE=""

  if [ "$http_status" = "200" ]; then
    node -e '
      const report = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      console.log(`Selftest status: ${report.status}`);
      for (const warning of report.warnings || []) {
        console.log(`  ⚠️  [${warning.component}] ${warning.message}`);
      }
    ' "$response_file" || echo "Selftest passed (HTTP 200), but the report could not be parsed." >&2
    rm -f "$response_file"
    return 0
  fi

  # Ein Container ohne SELFTEST_TOKEN antwortet 503 "self-test not configured":
  # Konfigurationslücke, kein App-Defekt -> warnen statt fälschlich zurückrollen.
  # Bewusst NICHT ausgenommen: 401 (Token-Mismatch Host/Container). Beide Seiten
  # lesen dieselbe .env; ein Mismatch wäre ein echtes Deploy-Problem und soll
  # auffallen — der image-only-Rollback ist dafür ein akzeptabler Preis.
  if grep -q "self-test not configured" "$response_file" 2>/dev/null; then
    echo "⚠️  Selftest not configured inside the container (HTTP $http_status) - gate skipped." >&2
    echo "   Ensure SELFTEST_TOKEN reaches the app container (compose.yaml/.env)." >&2
    rm -f "$response_file"
    return 0
  fi

  echo "Selftest failed (HTTP $http_status):" >&2
  node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(process.argv[1], "utf8");
    try {
      const report = JSON.parse(raw);
      for (const entry of report.errors || []) {
        console.error(`  ❌ [${entry.component}] ${entry.message}`);
      }
      if (report.error) console.error(`  ❌ ${report.error}`);
    } catch {
      console.error(raw);
    }
  ' "$response_file" >&2 || true
  rm -f "$response_file"
  return 1
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

# Qualitäts-Gates: deploy.sh ist die CI/CD-Pipeline (AGENTS.md) — ohne diese
# Schritte würde jede kompilierende Änderung ungeprüft in Produktion gehen.
echo "Running quality gate: lint..."
pnpm run lint

echo "Running quality gate: typecheck..."
pnpm exec tsx scripts/generate-version.ts
pnpm exec next typegen
pnpm exec tsc --noEmit

echo "Running quality gate: tests (with coverage thresholds)..."
# Die oben mit `set -a` geladene .env darf den Testlauf nicht steuern: Ihre Werte
# landen sonst über process.env in den Tests und entscheiden dort über Zusicherungen
# (SEED_ADMIN_NAME aus der Produktions-.env ließ die "alle oder keine"-Prüfung in
# config-validation.test.ts scheinbar bestehen). Deshalb jeden in .env definierten
# Namen für diesen Aufruf abräumen — die Tests bringen ihre Werte selbst mit und
# bekommen nebenbei keine Produktionsgeheimnisse mehr zu sehen.
TEST_ENV_UNSET=()
if [ -f "$PROJECT_DIR/.env" ]; then
  while IFS= read -r ENV_KEY; do
    [ -n "$ENV_KEY" ] || continue
    TEST_ENV_UNSET+=(-u "$ENV_KEY")
  done < <(sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=.*/\2/p' "$PROJECT_DIR/.env" | sort -u)
fi

# NODE_ENV=test nur für diesen Aufruf: das oben exportierte NODE_ENV=production
# lädt sonst den React-Production-Build und lässt die Testsuite geschlossen scheitern.
# Bewusst ohne --coverage: Die Coverage-Messung erfasst über collectCoverageFrom die
# ganze Codebasis und dominierte damit die Deploy-Dauer (~12 min statt ~1,5 min für
# dieselben Tests). Die Tests selbst bleiben Pflicht-Gate; die Schwellen werden
# separat über `pnpm run test:coverage` geprüft, nicht mehr bei jedem Deploy.
env ${TEST_ENV_UNSET[@]+"${TEST_ENV_UNSET[@]}"} CI=true NODE_ENV=test pnpm test

if [ -d "$PROJECT_DIR/.next" ]; then
  NEXT_BUILD_BACKUP_DIR="$(mktemp -d -t rag-mse-next-build-XXXXXX)"
  echo "Moving existing .next build artifacts to $NEXT_BUILD_BACKUP_DIR before rebuilding..."
  mv "$PROJECT_DIR/.next" "$NEXT_BUILD_BACKUP_DIR/.next"
fi

echo "Building Next.js app on host..."
pnpm run build

# Container-Skripte lösen ihre Pakete über /app/node_modules auf, das Next
# nur für Server-Routen traced. Ergänzen, dann prüfen.
echo "Bundling runtime dependencies for container scripts..."
node scripts/bundle-script-deps.mjs

echo "Running quality gate: container script dependencies..."
node scripts/check-script-deps.mjs

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

# Pre-Switch-Gate: den frisch gebauten Image-Stand als Wegwerf-Container mit
# leerer Wegwerf-Datenbank starten und per HTTP prüfen, BEVOR der Prod-Container
# ersetzt wird. "App bootet, aber Route 500t" fällt so vor dem Umschalten auf;
# nebenbei wird "Migrationen auf leerer DB" mitgeprüft. Niemals Prod-DB,
# Prod-Port oder Prod-Containername.
run_pre_switch_http_smoke() {
  local compose_project smoke_image candidate smoke_port_mapping smoke_url
  compose_project="${COMPOSE_PROJECT_NAME:-$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}"

  # podman-compose bildet den Image-Namen aus Projekt und Service. Der Separator
  # hängt von Version und `name_separator_compat` ab, der localhost/-Präfix vom
  # Speicherort — deshalb alle gängigen Schreibweisen durchprobieren, statt eine
  # davon fest anzunehmen.
  smoke_image=""
  for candidate in \
    "${compose_project}_app" \
    "${compose_project}-app" \
    "localhost/${compose_project}_app" \
    "localhost/${compose_project}-app"; do
    if podman image exists "$candidate"; then
      smoke_image="$candidate"
      break
    fi
  done

  if [ -z "$smoke_image" ]; then
    echo "HTTP smoke failed: freshly built image for service 'app' not found (project '$compose_project')." >&2
    podman images --format '{{.Repository}}:{{.Tag}}' >&2 || true
    return 1
  fi

  SMOKE_CONTAINER_NAME="rag-mse-smoke-$$"
  SMOKE_DATA_DIR="$(mktemp -d -t rag-mse-smoke-data-XXXXXX)"

  echo "Starting throwaway smoke container '$SMOKE_CONTAINER_NAME' (empty database)..."
  # Environment spiegelt die environment-Liste aus compose.yaml inklusive ihrer
  # Defaults (Konfig-Validierung läuft wie in Produktion) — bis auf die eigene
  # leere DB im Temp-Verzeichnis, den zufälligen freien Port und die bewusst
  # weggelassenen Seed-Variablen (ALLOW_DB_SEED/SEED_ADMIN_*).
  if ! podman run -d --name "$SMOKE_CONTAINER_NAME" \
    --user "${APP_RUNTIME_UID}:${APP_RUNTIME_GID}" \
    --userns "keep-id:uid=${APP_RUNTIME_UID},gid=${APP_RUNTIME_GID}" \
    -p "127.0.0.1::3000" \
    -v "$SMOKE_DATA_DIR:/app/data:rw" \
    -e NODE_ENV=production \
    -e DATABASE_URL="file:/app/data/smoke.db" \
    -e TZ="${TZ:-Europe/Berlin}" \
    -e DEVELOPMENT_DEPLOYMENT="${DEVELOPMENT_DEPLOYMENT:-false}" \
    -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-}" \
    -e NEXTAUTH_URL="${NEXTAUTH_URL:-}" \
    -e SMTP_HOST="${SMTP_HOST:-}" \
    -e SMTP_PORT="${SMTP_PORT:-}" \
    -e SMTP_USER="${SMTP_USER:-}" \
    -e SMTP_PASSWORD="${SMTP_PASSWORD:-}" \
    -e SMTP_FROM="${SMTP_FROM:-}" \
    -e EMAIL_DEV_MODE="${EMAIL_DEV_MODE:-false}" \
    -e EMAIL_DEV_LOG_METHOD="${EMAIL_DEV_LOG_METHOD:-logger}" \
    -e EMAIL_DEV_LOG_DIR="${EMAIL_DEV_LOG_DIR:-/app/data/logs/emails}" \
    -e DOCUMENTS_DIR="${DOCUMENTS_DIR:-/app/data/documents}" \
    -e DOCUMENT_UPLOAD_MAX_MB="${DOCUMENT_UPLOAD_MAX_MB:-15}" \
    -e AUSSCHREIBUNGEN_DIR="${AUSSCHREIBUNGEN_DIR:-/app/data/ausschreibungen}" \
    -e AUSSCHREIBUNG_UPLOAD_MAX_MB="${AUSSCHREIBUNG_UPLOAD_MAX_MB:-15}" \
    -e EVENT_REMINDER_POLL_INTERVAL_MS="${EVENT_REMINDER_POLL_INTERVAL_MS:-3600000}" \
    -e NOTIFICATION_TOKEN_VALIDITY_DAYS="${NOTIFICATION_TOKEN_VALIDITY_DAYS:-60}" \
    -e ADMIN_EMAILS="${ADMIN_EMAILS:-}" \
    -e APP_NAME="${APP_NAME:-RAG Schießsport MSE}" \
    -e APP_URL="${APP_URL:-}" \
    -e APP_TIMEZONE="${APP_TIMEZONE:-Europe/Berlin}" \
    -e NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-}" \
    -e COOKIE_SECURE="${COOKIE_SECURE:-}" \
    -e COOKIE_MAX_AGE="${COOKIE_MAX_AGE:-604800}" \
    -e TRUSTED_PROXY_IPS="${TRUSTED_PROXY_IPS:-127.0.0.1/32,::1,10.0.2.0/24,10.88.0.0/16}" \
    -e SELFTEST_TOKEN="${SELFTEST_TOKEN:-}" \
    -e SELFTEST_CHECK_SMTP="${SELFTEST_CHECK_SMTP:-true}" \
    -e RATE_LIMIT_FAIL_OPEN="${RATE_LIMIT_FAIL_OPEN:-false}" \
    -e MAX_REQUEST_BODY_SIZE="${MAX_REQUEST_BODY_SIZE:-1048576}" \
    "$smoke_image" >/dev/null; then
    echo "HTTP smoke failed: could not start throwaway container." >&2
    return 1
  fi

  smoke_port_mapping="$(podman port "$SMOKE_CONTAINER_NAME" 3000 2>/dev/null | head -n 1)"
  if [ -z "$smoke_port_mapping" ]; then
    echo "HTTP smoke failed: no published port for throwaway container." >&2
    podman logs --tail 100 "$SMOKE_CONTAINER_NAME" >&2 || true
    return 1
  fi
  smoke_url="http://${smoke_port_mapping}"

  echo "Waiting for smoke container to answer on ${smoke_url} ..."
  local attempt=1
  while ! curl -sf --max-time 3 "${smoke_url}/api/health" >/dev/null 2>&1; do
    if [ "$attempt" -ge 40 ]; then
      echo "HTTP smoke failed: container did not answer within 120s." >&2
      podman logs --tail 150 "$SMOKE_CONTAINER_NAME" >&2 || true
      return 1
    fi
    if [ -z "$(podman ps -q --filter "name=^${SMOKE_CONTAINER_NAME}\$")" ]; then
      echo "HTTP smoke failed: throwaway container exited during startup." >&2
      podman logs --tail 150 "$SMOKE_CONTAINER_NAME" >&2 || true
      return 1
    fi
    sleep 3
    attempt=$((attempt + 1))
  done

  # timeout als Backstop: das Skript begrenzt jeden Request auf 15 s, aber ein
  # hängendes Deploy darf auch bei unvorhergesehenem Verhalten nicht ewig stehen.
  if ! timeout 300 node "$PROJECT_DIR/scripts/check-http-smoke.js" "$smoke_url"; then
    echo "HTTP smoke failed: see report above." >&2
    podman logs --tail 100 "$SMOKE_CONTAINER_NAME" >&2 || true
    return 1
  fi

  cleanup_smoke_container
  return 0
}

echo "Running pre-switch HTTP smoke check against the freshly built image..."
if ! run_pre_switch_http_smoke; then
  cleanup_smoke_container
  # podman-compose build hat den Compose-Tag bereits auf das durchgefallene
  # Image umgehängt: zurücktaggen, damit ein späteres manuelles
  # `podman-compose up -d` nicht das ungetestete Image startet.
  if [ -n "${PREV_IMAGE_ID:-}" ] && [ -n "${PREV_IMAGE_NAME:-}" ]; then
    echo "Restoring previous app image tag ($PREV_IMAGE_NAME -> $PREV_IMAGE_ID)..." >&2
    podman tag "$PREV_IMAGE_ID" "$PREV_IMAGE_NAME" || true
  fi
  echo "Deployment failed during pre-switch HTTP smoke check. The running production container was not touched." >&2
  exit 1
fi

# Backup unmittelbar VOR dem Container-Neustart (nicht vor dem Build):
# So enthält es alle Benutzer-Schreibzugriffe aus dem Build-Zeitfenster, und ein
# Restore nach fehlgeschlagener Migration verwirft keine Benutzerdaten.
echo "Creating pre-deploy database backup..."
DB_FILE=""
if DB_FILE="$(resolve_host_sqlite_path "${DATABASE_URL:-}")" && [ -f "$DB_FILE" ]; then
  BACKUP_DIR="./data/backups"
  BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d_%H%M%S).db"
  mkdir -p "$BACKUP_DIR"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".timeout 5000" ".backup '$BACKUP_FILE'"
  else
    # Ohne sqlite3 kein konsistenter Online-Backup-Befehl: Das WAL muss mitkopiert
    # werden, sonst fehlen committete, noch nicht zurückgeschriebene Änderungen.
    cp "$DB_FILE" "$BACKUP_FILE"
    if [ -f "$DB_FILE-wal" ]; then cp "$DB_FILE-wal" "$BACKUP_FILE-wal"; fi
  fi
  echo "✅ Pre-deploy backup: $BACKUP_FILE"

  # Aufbewahrungsgrenze: nur die letzten 10 Pre-Deploy-Backups behalten
  PRE_DEPLOY_KEEP=10
  ls -1t "$BACKUP_DIR"/pre-deploy-*.db 2>/dev/null | tail -n "+$((PRE_DEPLOY_KEEP + 1))" | while IFS= read -r OLD_BACKUP; do
    echo "Removing old pre-deploy backup: $OLD_BACKUP"
    rm -f "$OLD_BACKUP" "$OLD_BACKUP-wal"
  done
else
  echo "⚠️  No database file found at '${DB_FILE:-<DATABASE_URL not set>}' on host, skipping backup."
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

# 60 Versuche à 3s (~3 min): längere Migrationen dürfen keinen falschen
# Rollback auslösen.
if ! wait_for_service_health "app" "healthy" 60; then
  echo "Deployment failed: new app container did not become healthy (e.g. failed migration)." >&2
  # Container war nie healthy -> seit dem Backup gab es keine Benutzer-Schreibzugriffe;
  # DB-Restore macht nur eine ggf. fehlgeschlagene Migration rückgängig.
  rollback_deployment "with-db-restore"
  exit 1
fi

echo "Running post-deploy CSP smoke check..."
if ! node "$PROJECT_DIR/scripts/check-csp-smoke.js" "http://127.0.0.1:3000/"; then
  echo "Deployment failed: CSP smoke check failed." >&2
  # App war bereits healthy und hat evtl. Anfragen angenommen -> DB unangetastet lassen.
  rollback_deployment "image-only"
  exit 1
fi

echo "Running post-deploy selftest gate..."
if ! run_post_deploy_selftest; then
  echo "Deployment failed: post-deploy selftest reported errors." >&2
  # App war bereits healthy und hat evtl. Anfragen angenommen -> DB unangetastet lassen.
  rollback_deployment "image-only"
  exit 1
fi

echo "Cleaning up unused Podman images..."
podman image prune -f >/dev/null

DEPLOY_SUCCEEDED=1
echo "Deployment completed successfully!"

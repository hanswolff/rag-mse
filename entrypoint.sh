#!/bin/sh
set -e

echo "Starting application..."
echo "Environment: ${NODE_ENV:-development}"

# Resolve database file path from DATABASE_URL (SQLite file URL expected)
DB_URL="${DATABASE_URL:-file:./data/prod.db}"
case "$DB_URL" in
  file:/*)
    DB_FILE="${DB_URL#file:}"
    ;;
  file:./*)
    DB_FILE="/app/${DB_URL#file:./}"
    ;;
  file:*)
    DB_FILE="/app/${DB_URL#file:}"
    ;;
  *)
    DB_FILE="/app/data/prod.db"
    ;;
esac

# Einmalige Migration: Produktions-DB hieß historisch dev.db. Liegt am Ziel
# noch keine prod.db, aber eine dev.db im selben Verzeichnis, wird sie
# umbenannt (inkl. WAL/SHM). Läuft vor dem Serverstart, daher gefahrlos.
LEGACY_DB_FILE="$(dirname "$DB_FILE")/dev.db"

# Existieren beide Dateien, ist unklar, welche die echten Daten enthält —
# lieber laut scheitern als stillschweigend mit der falschen (womöglich
# leeren) prod.db starten und die Daten in dev.db zurücklassen.
if [ -f "$DB_FILE" ] && [ "$(basename "$DB_FILE")" = "prod.db" ] && [ -f "$LEGACY_DB_FILE" ]; then
  echo "ERROR: Both $DB_FILE and legacy $LEGACY_DB_FILE exist." >&2
  echo "Refusing to start: unclear which file holds the real data." >&2
  echo "Inspect both, keep the correct one as prod.db, then remove/archive dev.db*." >&2
  exit 1
fi

if [ ! -f "$DB_FILE" ] && [ "$(basename "$DB_FILE")" = "prod.db" ] && [ -f "$LEGACY_DB_FILE" ]; then
  echo "Migrating legacy database $LEGACY_DB_FILE -> $DB_FILE..."
  mv "$LEGACY_DB_FILE" "$DB_FILE"
  if [ -f "$LEGACY_DB_FILE-wal" ]; then mv "$LEGACY_DB_FILE-wal" "$DB_FILE-wal"; fi
  if [ -f "$LEGACY_DB_FILE-shm" ]; then mv "$LEGACY_DB_FILE-shm" "$DB_FILE-shm"; fi
fi

DB_WAS_MISSING=0
if [ ! -f "$DB_FILE" ]; then
  DB_WAS_MISSING=1
  echo "Database not found at $DB_FILE, preparing directory..."
  mkdir -p "$(dirname "$DB_FILE")"
fi

# Ablageverzeichnisse anlegen, damit der Selbsttest auf frischen Installationen
# nicht bis zum ersten Upload einen Fehler meldet
mkdir -p "${DOCUMENTS_DIR:-/app/data/documents}" "${AUSSCHREIBUNGEN_DIR:-/app/data/ausschreibungen}"

# Validate configuration before starting
echo "Validating configuration..."
node scripts-dist/scripts/validate-config.js

# Run idempotent SQL migrations for existing databases
echo "Running database migrations..."
node scripts-dist/scripts/run-db-migrations.js

if [ "$DB_WAS_MISSING" -eq 1 ]; then
  echo "Database initialized at $DB_FILE."
  if [ "${ALLOW_DB_SEED}" = "true" ]; then
    echo "ALLOW_DB_SEED is set to true. Running database seed..."
    node scripts-dist/prisma/seed.js
    echo "Database seeded successfully"
  else
    echo "Skipping database seed (ALLOW_DB_SEED is not true)."
  fi
fi

# Start the application with explicit NODE_ENV
export NODE_ENV="${NODE_ENV:-development}"
exec node server.js

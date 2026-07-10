#!/bin/sh
set -e

echo "Starting application..."
echo "Environment: ${NODE_ENV:-development}"

# Resolve database file path from DATABASE_URL (SQLite file URL expected)
DB_URL="${DATABASE_URL:-file:./data/dev.db}"
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
    DB_FILE="/app/data/dev.db"
    ;;
esac

DB_WAS_MISSING=0
if [ ! -f "$DB_FILE" ]; then
  DB_WAS_MISSING=1
  echo "Database not found at $DB_FILE, preparing directory..."
  mkdir -p "$(dirname "$DB_FILE")"
fi

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

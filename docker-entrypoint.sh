#!/bin/sh
set -e

echo "Starting application..."
echo "Environment: ${NODE_ENV:-development}"

# Validate configuration before starting
echo "Validating configuration..."
node scripts/validate-config.js

# Run idempotent SQL migrations for existing databases
echo "Running database migrations..."
node scripts/run-db-migrations.js

# Check if database exists, if not create it
if [ ! -f /app/data/dev.db ]; then
  echo "Database not found, creating..."

  # In production, require explicit flags for database operations
  if [ "${NODE_ENV}" = "production" ] && [ "${DEVELOPMENT_DEPLOYMENT}" != "true" ]; then
    echo "WARNING: Production mode detected."
    echo "Database initialization is disabled in production for safety."
    echo ""
    echo "To enable database operations in production, set the following environment variables:"
    echo "  - ALLOW_DB_PUSH=true  (to enable prisma db push)"
    echo "  - ALLOW_DB_SEED=true  (to enable database seeding)"
    echo ""
    echo "Recommended: Use controlled migrations instead of automatic db push."
    echo "See README.md for more information on the migration process."
    echo ""
    echo "Exiting with error. Please configure database initialization properly."
    exit 1
  fi

  # Check for explicit flags
  if [ "${ALLOW_DB_PUSH}" = "true" ]; then
    echo "ALLOW_DB_PUSH is set to true. Running prisma db push..."
    npx prisma db push
    echo "Database schema pushed successfully"
  else
    echo "ALLOW_DB_PUSH is not set or set to false. Skipping prisma db push."
    echo "Database initialization may be incomplete without a schema."
    echo "Set ALLOW_DB_PUSH=true to enable schema pushing."
  fi

  echo "Database created successfully"

  if [ "${ALLOW_DB_SEED}" = "true" ]; then
    echo "ALLOW_DB_SEED is set to true. Running database seed..."
    npm run db:seed
    echo "Database seeded successfully"
  else
    echo "ALLOW_DB_SEED is not set or set to false. Skipping database seeding."
    echo "You may need to create an initial admin user manually."
    echo "Set ALLOW_DB_SEED=true to enable database seeding."
  fi
fi

# Start the application with explicit NODE_ENV
export NODE_ENV="${NODE_ENV:-development}"
exec node server.js

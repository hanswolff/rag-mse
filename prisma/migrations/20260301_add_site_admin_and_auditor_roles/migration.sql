-- Add logical role values in application layer and migrate initial admin user.
-- SQLite stores enum values as TEXT in this schema, so only data migration is required.
UPDATE "User"
SET "role" = 'SITE_ADMINISTRATOR'
WHERE "id" = (
  SELECT "id"
  FROM "User"
  WHERE "role" = 'ADMIN'
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM "User"
  WHERE "role" = 'SITE_ADMINISTRATOR'
);

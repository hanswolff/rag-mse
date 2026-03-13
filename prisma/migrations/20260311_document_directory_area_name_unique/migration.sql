-- Replace global uniqueness on nameNormalized with area-scoped uniqueness.
DROP INDEX IF EXISTS "DocumentDirectory_nameNormalized_key";

UPDATE "DocumentDirectory"
SET "nameNormalized" = CASE
  WHEN "nameNormalized" LIKE 'ADMIN:%' THEN substr("nameNormalized", 7)
  WHEN "nameNormalized" LIKE 'MEMBER:%' THEN substr("nameNormalized", 8)
  ELSE "nameNormalized"
END;

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentDirectory_area_nameNormalized_key"
ON "DocumentDirectory"("area", "nameNormalized");

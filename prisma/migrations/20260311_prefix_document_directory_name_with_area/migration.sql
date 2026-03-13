-- Prefix normalized directory names with area so uniqueness is scoped by area.
UPDATE "DocumentDirectory"
SET "nameNormalized" = "area" || ':' || "nameNormalized"
WHERE "nameNormalized" NOT LIKE 'ADMIN:%' AND "nameNormalized" NOT LIKE 'MEMBER:%';

-- Activate all existing SITE_ADMINISTRATOR accounts that are not yet activated
UPDATE "User" SET "activatedAt" = "createdAt" WHERE "role" = 'SITE_ADMINISTRATOR' AND "activatedAt" IS NULL;

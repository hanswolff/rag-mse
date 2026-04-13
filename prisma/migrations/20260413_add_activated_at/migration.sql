-- Add activatedAt field to User for explicit account activation tracking
ALTER TABLE "User" ADD COLUMN "activatedAt" DATETIME;

-- Backfill: users who already have a password set are considered activated
UPDATE "User" SET "activatedAt" = "passwordUpdatedAt" WHERE "passwordUpdatedAt" IS NOT NULL;

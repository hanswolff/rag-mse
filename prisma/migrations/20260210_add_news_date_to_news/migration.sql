ALTER TABLE "News" ADD COLUMN "newsDate" DATETIME;

UPDATE "News"
SET "newsDate" = "createdAt"
WHERE "newsDate" IS NULL;

CREATE INDEX IF NOT EXISTS "News_newsDate_idx" ON "News"("newsDate");

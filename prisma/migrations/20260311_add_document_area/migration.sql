-- Add DocumentArea enum support for documents and directories.
-- SQLite stores enum values as TEXT in this schema, so we add TEXT columns with default 'ADMIN'.

ALTER TABLE "Document" ADD COLUMN "area" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "DocumentDirectory" ADD COLUMN "area" TEXT NOT NULL DEFAULT 'ADMIN';

CREATE INDEX "Document_area_idx" ON "Document"("area");
CREATE INDEX "DocumentDirectory_area_idx" ON "DocumentDirectory"("area");

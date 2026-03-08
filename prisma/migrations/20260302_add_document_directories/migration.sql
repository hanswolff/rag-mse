CREATE TABLE "DocumentDirectory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "DocumentDirectory_nameNormalized_key" ON "DocumentDirectory"("nameNormalized");
CREATE INDEX "DocumentDirectory_name_idx" ON "DocumentDirectory"("name");

ALTER TABLE "Document"
ADD COLUMN "directoryId" TEXT REFERENCES "DocumentDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Document_directoryId_idx" ON "Document"("directoryId");

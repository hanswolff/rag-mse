CREATE TABLE "Ausschreibung" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Ausschreibung_storedFileName_key" ON "Ausschreibung"("storedFileName");
CREATE INDEX "Ausschreibung_expiresAt_idx" ON "Ausschreibung"("expiresAt");

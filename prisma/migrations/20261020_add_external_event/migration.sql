-- Fremdtermin: von Dritten ausgerichtetes Ereignis mit Zeitraum (ganztägig oder
-- mit Uhrzeit), optionaler Art und Sichtbarkeitsstufe (Default MEMBER). Verweise
-- auf Ausschreibung und Ersteller werden beim Löschen auf NULL gesetzt.
CREATE TABLE "ExternalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "location" TEXT,
    "description" TEXT,
    "url" TEXT,
    "kind" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'MEMBER',
    "ausschreibungId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalEvent_ausschreibungId_fkey" FOREIGN KEY ("ausschreibungId") REFERENCES "Ausschreibung" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExternalEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExternalEvent_startDate_idx" ON "ExternalEvent"("startDate");
CREATE INDEX "ExternalEvent_endDate_idx" ON "ExternalEvent"("endDate");

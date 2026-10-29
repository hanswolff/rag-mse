-- Abwesenheit: vom Benutzer selbst eingetragener Zeitraum, in dem er nicht
-- verfügbar ist (ganztägig oder mit Uhrzeit, optionaler Grund). Wird mit dem
-- Benutzer gelöscht und vom Maintenance-Worker 30 Tage nach Ende entfernt.
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Absence_userId_idx" ON "Absence"("userId");
CREATE INDEX "Absence_startDate_idx" ON "Absence"("startDate");
CREATE INDEX "Absence_endDate_idx" ON "Absence"("endDate");

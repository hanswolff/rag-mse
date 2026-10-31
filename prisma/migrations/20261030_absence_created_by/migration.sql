-- Abwesenheit: "eingetragen von" (createdById, ON DELETE SET NULL). Bestehende
-- Abwesenheiten hat der Benutzer selbst eingetragen, daher createdById = userId.
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_Absence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Absence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Absence" ("id", "userId", "startDate", "endDate", "allDay", "timeFrom", "timeTo", "reason", "createdById", "createdAt", "updatedAt")
SELECT "id", "userId", "startDate", "endDate", "allDay", "timeFrom", "timeTo", "reason", "userId", "createdAt", "updatedAt" FROM "Absence";
DROP TABLE "Absence";
ALTER TABLE "new_Absence" RENAME TO "Absence";
CREATE INDEX "Absence_userId_idx" ON "Absence"("userId");
CREATE INDEX "Absence_startDate_idx" ON "Absence"("startDate");
CREATE INDEX "Absence_endDate_idx" ON "Absence"("endDate");

PRAGMA defer_foreign_keys=OFF;

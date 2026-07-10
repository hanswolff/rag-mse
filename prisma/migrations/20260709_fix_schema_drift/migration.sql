-- Schema-Drift zwischen schema.prisma und real ausgerollten Datenbanken bereinigen.
-- Tabellen-Neubauten folgen dem Prisma-Standardmuster (new_-Tabelle, Daten kopieren, umbenennen).

PRAGMA defer_foreign_keys=ON;

-- User: "name" ist nullable (Baseline hatte NOT NULL), "hasPossessionCard" als BOOLEAN DEFAULT false.
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "lastLoginAt" DATETIME,
    "passwordUpdatedAt" DATETIME,
    "activatedAt" DATETIME,
    "memberSince" DATETIME,
    "dateOfBirth" DATETIME,
    "rank" TEXT,
    "pk" TEXT,
    "reservistsAssociation" TEXT,
    "associationMemberNumber" TEXT,
    "hasPossessionCard" BOOLEAN NOT NULL DEFAULT false,
    "eventReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eventReminderDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "pollNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("id", "email", "password", "name", "address", "phone", "role", "lastLoginAt", "passwordUpdatedAt", "activatedAt", "memberSince", "dateOfBirth", "rank", "pk", "reservistsAssociation", "associationMemberNumber", "hasPossessionCard", "eventReminderEnabled", "eventReminderDaysBefore", "pollNotificationEnabled", "adminNotes", "createdAt", "updatedAt")
SELECT "id", "email", "password", "name", "address", "phone", "role", "lastLoginAt", "passwordUpdatedAt", "activatedAt", "memberSince", "dateOfBirth", "rank", "pk", "reservistsAssociation", "associationMemberNumber", "hasPossessionCard", "eventReminderEnabled", "eventReminderDaysBefore", "pollNotificationEnabled", "adminNotes", "createdAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Poll: CHECK-Constraints und Spalten-Default 'SONSTIGES' entfernen — beides ist in
-- schema.prisma nicht abgebildet; Enum-Werte werden vom Prisma-Client erzwungen.
CREATE TABLE "new_Poll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "multipleChoice" BOOLEAN NOT NULL DEFAULT false,
    "shortCode" TEXT,
    "eventId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Poll_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Poll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Poll" ("id", "title", "description", "type", "status", "multipleChoice", "shortCode", "eventId", "createdById", "createdAt", "updatedAt")
SELECT "id", "title", "description", "type", "status", "multipleChoice", "shortCode", "eventId", "createdById", "createdAt", "updatedAt" FROM "Poll";
DROP TABLE "Poll";
ALTER TABLE "new_Poll" RENAME TO "Poll";
CREATE UNIQUE INDEX "Poll_shortCode_key" ON "Poll"("shortCode");
CREATE INDEX "Poll_status_idx" ON "Poll"("status");
CREATE INDEX "Poll_eventId_idx" ON "Poll"("eventId");
CREATE INDEX "Poll_type_status_idx" ON "Poll"("type", "status");

-- News: "newsDate" NOT NULL absichern. Datenbanken, die den Migrationspfad
-- 20260210_add_news_date_to_news genommen haben, tragen die Spalte nullable.
UPDATE "News" SET "newsDate" = "createdAt" WHERE "newsDate" IS NULL;
CREATE TABLE "new_News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "newsDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_News" ("id", "title", "content", "newsDate", "published", "createdAt", "updatedAt")
SELECT "id", "title", "content", "newsDate", "published", "createdAt", "updatedAt" FROM "News";
DROP TABLE "News";
ALTER TABLE "new_News" RENAME TO "News";
CREATE INDEX "News_newsDate_idx" ON "News"("newsDate");

PRAGMA defer_foreign_keys=OFF;

-- Invitation: in schema.prisma deklarierter Composite-Index existierte in keiner Migration.
CREATE INDEX IF NOT EXISTS "Invitation_email_usedAt_idx" ON "Invitation"("email", "usedAt");

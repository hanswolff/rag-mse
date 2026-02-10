-- Database initialization script for RAG Schießsport MSE
-- This script creates all tables and indexes needed for the application
-- Run this once to initialize a fresh database

-- Create Users table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create Events table
CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "timeFrom" TEXT NOT NULL,
    "timeTo" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "type" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create Votes table
CREATE TABLE IF NOT EXISTS "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create News table
CREATE TABLE IF NOT EXISTS "News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "newsDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create ShootingRange table
CREATE TABLE IF NOT EXISTS "ShootingRange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create Invitations table
CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "invitedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create PasswordReset table
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create OutgoingEmail table
CREATE TABLE IF NOT EXISTS "OutgoingEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "template" TEXT NOT NULL,
    "toRecipients" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "firstQueuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME,
    "lastError" TEXT,
    "lockedUntil" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_userId_eventId_key" ON "Vote"("userId", "eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordReset_email_idx" ON "PasswordReset"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ShootingRange_name_key" ON "ShootingRange"("name");
CREATE INDEX IF NOT EXISTS "News_newsDate_idx" ON "News"("newsDate");
CREATE INDEX IF NOT EXISTS "OutgoingEmail_status_nextAttemptAt_idx" ON "OutgoingEmail"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "OutgoingEmail_status_lockedUntil_idx" ON "OutgoingEmail"("status", "lockedUntil");

-- Seed shooting ranges
INSERT OR IGNORE INTO "ShootingRange" ("id", "name", "street", "postalCode", "city", "latitude", "longitude", "createdAt", "updatedAt") VALUES
  ('range_grischow', 'Schützenverein Grischow 1894/1992', 'Oberstriet 2', '17089', 'Grischow', 53.69290860350169, 13.335883820165746, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_vier_tore', 'Schützenverein "Vier Tore" e.V.', 'Zur Datze 15', '17034', 'Neubrandenburg', 53.57030963967344, 13.305432186507492, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_guestrow', 'Privilegierte Schützengesellschaft zu Güstrow e.V.', 'Koppelweg 12b', '18273', 'Güstrow', 53.80972484274375, 12.239689271164167, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_stavenhagen', 'Schützengesellschaft 1884 der Reuterstadt Stavenhagen e.V.', 'Stadtholz 4a', '17153', 'Stavenhagen', 53.70109808691019, 12.924401412887129, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_fuerstensee', 'Schießstand Fürstensee', NULL, '17235', 'Neustrelitz', 53.29723665039616, 13.125446177664209, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_burg_stargard', 'Schützenverein Burg Stargard', NULL, '17094', 'Burg Stargard', 53.499856125744394, 13.347091976262474, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_waren_mueritz', 'Schützenzunft Waren Müritz e.V. Schießstand', 'Kargower Weg 5', '17192', 'Waren (Müritz)', 53.50487941974799, 12.721974213492508, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_wittstock', 'Schießstand Wittstock', 'Weg zur Schäferei 2', '16909', 'Wittstock/Dosse', 53.222420789586586, 12.559584655191628, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_neustrelitz', 'Schützengilde Neustrelitz 1767 e.V.', 'Pappelallee 19', '17235', 'Neustrelitz', 53.35090444848738, 13.055526434111679, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('range_parow', 'Marinetechnikschule Parow', 'Schießplatz der Bundeswehr, Pappelallee 24', '18445', 'Kramerhof', 54.37460430504266, 13.082525704380235, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Admin user creation (uncomment and replace placeholders before running)
-- DELETE FROM User WHERE id='admin001';
-- INSERT INTO User (id, email, password, name, role, createdAt, updatedAt)
-- VALUES ('admin001', '<ADMIN_EMAIL>', '<BCRYPT_HASH>', '<ADMIN_NAME>', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
-- SELECT id, email, name, role FROM User;

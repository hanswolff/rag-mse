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

CREATE INDEX IF NOT EXISTS "OutgoingEmail_status_nextAttemptAt_idx" ON "OutgoingEmail"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "OutgoingEmail_status_lockedUntil_idx" ON "OutgoingEmail"("status", "lockedUntil");

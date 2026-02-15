ALTER TABLE "User" ADD COLUMN "eventReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "eventReminderDaysBefore" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE "EventReminderDispatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "rsvpTokenHash" TEXT NOT NULL,
  "rsvpTokenExpiresAt" DATETIME NOT NULL,
  "unsubscribeTokenHash" TEXT NOT NULL,
  "unsubscribeTokenExpiresAt" DATETIME NOT NULL,
  "queuedAt" DATETIME NOT NULL,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "EventReminderDispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventReminderDispatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventReminderDispatch_daysBefore_check" CHECK ("daysBefore" >= 1 AND "daysBefore" <= 14)
);

CREATE UNIQUE INDEX "EventReminderDispatch_rsvpTokenHash_key" ON "EventReminderDispatch"("rsvpTokenHash");
CREATE UNIQUE INDEX "EventReminderDispatch_unsubscribeTokenHash_key" ON "EventReminderDispatch"("unsubscribeTokenHash");
CREATE UNIQUE INDEX "EventReminderDispatch_userId_eventId_key" ON "EventReminderDispatch"("userId", "eventId");
CREATE INDEX "EventReminderDispatch_eventId_idx" ON "EventReminderDispatch"("eventId");

-- Add poll notification setting to users
ALTER TABLE "User" ADD COLUMN "pollNotificationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Create Poll table
CREATE TABLE "Poll" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'SONSTIGES',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "multipleChoice" BOOLEAN NOT NULL DEFAULT false,
  "shortCode" TEXT,
  "eventId" TEXT,
  "createdById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Poll_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Poll_type_check" CHECK ("type" IN ('TERMIN', 'SONSTIGES')),
  CONSTRAINT "Poll_status_check" CHECK ("status" IN ('DRAFT', 'LIVE', 'CLOSED'))
);

CREATE UNIQUE INDEX "Poll_shortCode_key" ON "Poll"("shortCode");
CREATE INDEX "Poll_status_idx" ON "Poll"("status");
CREATE INDEX "Poll_eventId_idx" ON "Poll"("eventId");
CREATE INDEX "Poll_type_status_idx" ON "Poll"("type", "status");

-- Create PollOption table
CREATE TABLE "PollOption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pollId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- Create PollVote table
CREATE TABLE "PollVote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pollId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PollVote_pollId_userId_optionId_key" ON "PollVote"("pollId", "userId", "optionId");
CREATE INDEX "PollVote_pollId_idx" ON "PollVote"("pollId");
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");

-- Create PollNotificationDispatch table
CREATE TABLE "PollNotificationDispatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pollId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "queuedAt" DATETIME NOT NULL,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PollNotificationDispatch_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PollNotificationDispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PollNotificationDispatch_pollId_userId_key" ON "PollNotificationDispatch"("pollId", "userId");
CREATE INDEX "PollNotificationDispatch_pollId_idx" ON "PollNotificationDispatch"("pollId");

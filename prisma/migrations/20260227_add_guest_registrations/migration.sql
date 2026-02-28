CREATE TABLE "GuestRegistration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "vote" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GuestRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuestRegistration_vote_check" CHECK ("vote" IN ('JA', 'NEIN', 'VIELLEICHT'))
);

CREATE UNIQUE INDEX "GuestRegistration_eventId_name_key" ON "GuestRegistration"("eventId", "name");
CREATE INDEX "GuestRegistration_eventId_idx" ON "GuestRegistration"("eventId");

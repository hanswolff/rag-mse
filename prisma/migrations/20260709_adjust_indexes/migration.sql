-- Index-Bereinigung (Code-Review, niedrige Priorität):
-- 1. Invitation_email_idx ist redundant — Präfix des Composite-Index Invitation_email_usedAt_idx.
-- 2. Cascade-FK-Spalten ohne Index verlangsamen ON DELETE CASCADE (Tabellenscan je Löschung).
DROP INDEX IF EXISTS "Invitation_email_idx";

CREATE INDEX "PollVote_optionId_idx" ON "PollVote"("optionId");

CREATE INDEX "PollNotificationDispatch_userId_idx" ON "PollNotificationDispatch"("userId");

-- Einmal-Token (Passwort-Reset, Einladung, RSVP, Abmeldung) nicht mehr im Klartext im
-- Postausgang speichern: Der Text-/HTML-Body enthält nur noch Platzhalter, die Token
-- liegen bis zum Versand in dieser Spalte und werden danach geleert.
ALTER TABLE "OutgoingEmail" ADD COLUMN "sensitiveTokensJson" TEXT;

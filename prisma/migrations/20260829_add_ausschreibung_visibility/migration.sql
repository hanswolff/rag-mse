-- Sichtbarkeit der Ausschreibung: PUBLIC (öffentlich), MEMBER (nur eingeloggte
-- Benutzer), HIDDEN (nur im Adminbereich). Bestandsdaten waren ausnahmslos
-- öffentlich — CONTEXT.md führte „für alle Besucher sichtbar“ bis hierher als
-- Wesenseigenschaft der Ausschreibung —, deshalb PUBLIC als Default und Backfill.
ALTER TABLE "Ausschreibung" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

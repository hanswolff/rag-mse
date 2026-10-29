-- Sichtbarkeitsstufe des Termins: PUBLIC (öffentlich), MEMBER (nur eingeloggte
-- Benutzer), HIDDEN (nur im Adminbereich). Ersetzt das Ja/Nein-Feld „visible“:
-- sichtbare Termine werden PUBLIC, ausgeblendete HIDDEN.
-- „visible“ bleibt bis zum Folgerelease erhalten, damit ein Image-Rollback auf den
-- Stand vor 1.8.0 lauffähig bleibt (ADR 0008). Die Trigger halten es konservativ
-- synchron: nur PUBLIC gilt dort als sichtbar.
ALTER TABLE "Event" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';
UPDATE "Event" SET "visibility" = 'HIDDEN' WHERE "visible" = 0;

CREATE TRIGGER "Event_visible_sync_insert" AFTER INSERT ON "Event"
WHEN NEW."visibility" <> 'PUBLIC'
BEGIN
  UPDATE "Event" SET "visible" = 0 WHERE "id" = NEW."id";
END;

CREATE TRIGGER "Event_visible_sync_update" AFTER UPDATE OF "visibility" ON "Event"
BEGIN
  UPDATE "Event" SET "visible" = (NEW."visibility" = 'PUBLIC') WHERE "id" = NEW."id";
END;

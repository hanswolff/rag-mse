-- Release 1.8.0: News zum Vereinskalender (vom Product Owner freigegebener Text).
-- Feste ID + INSERT OR IGNORE verhindern Duplikate, falls die News schon existiert.
-- Dass eine im Adminbereich bearbeitete oder gelöschte News nicht wiederkommt, liegt
-- allein am Eintrag in "_AppMigration": die Migration läuft nur einmal.
-- Datum = Zeitpunkt des Deployments (Migrationslauf), im Format des
-- Prisma-SQLite-Adapters (ISO 8601 in UTC, z. B. 2026-10-19T08:00:00.000+00:00).
INSERT OR IGNORE INTO "News" ("id", "title", "content", "newsDate", "published", "createdAt", "updatedAt")
VALUES (
  'news-vereinskalender-1-8-0',
  'Neu: Der Vereinskalender',
  'Ab sofort gibt es unter „Kalender“ eine Monats-, Wochen- und Listenansicht aller Termine. Öffentliche Termine sieht jeder, und der Kalender lässt sich als iCal-Abo in die eigene Kalender-App übernehmen. Eingeloggte Mitglieder sehen zusätzlich interne Termine sowie Termine anderer Veranstalter, etwa geplante RDLs oder Veranstaltungen anderer Reservistenkameradschaften.

Neu ist auch: Ihr könnt im Kalender eure Abwesenheiten eintragen, zum Beispiel Urlaub oder Schichtdienst. Diese Einträge sehen nur ihr selbst und der Vorstand. Sie helfen uns, Termine so zu planen, dass möglichst viele teilnehmen können. Abwesenheiten werden 30 Tage nach ihrem Ende automatisch gelöscht.',
  strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now'),
  1,
  strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now'),
  strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now')
);

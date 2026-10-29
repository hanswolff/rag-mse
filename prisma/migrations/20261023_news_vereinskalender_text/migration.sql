-- Korrektur der Release-News 1.8.0 (vom Product Owner freigegeben, 19.10.2026):
-- Abwesenheiten sehen Administratoren und Prüfer, nicht „der Vorstand“.
-- Ändert nur den unveränderten Originaltext; eine im Adminbereich bearbeitete News bleibt.
UPDATE "News"
SET
  "content" = 'Ab sofort gibt es unter „Kalender“ eine Monats-, Wochen- und Listenansicht aller Termine. Öffentliche Termine sieht jeder, und der Kalender lässt sich als iCal-Abo in die eigene Kalender-App übernehmen. Eingeloggte Mitglieder sehen zusätzlich interne Termine sowie Termine anderer Veranstalter, etwa geplante RDLs oder Veranstaltungen anderer Reservistenkameradschaften.

Neu ist auch: Ihr könnt im Kalender eure Abwesenheiten eintragen, zum Beispiel Urlaub oder Schichtdienst. Diese Einträge sehen nur ihr selbst sowie die Administratoren und Prüfer des Vereins. Sie helfen uns, Termine so zu planen, dass möglichst viele teilnehmen können. Abwesenheiten werden 30 Tage nach ihrem Ende automatisch gelöscht.',
  "updatedAt" = strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now')
WHERE "id" = 'news-vereinskalender-1-8-0'
  AND "content" = 'Ab sofort gibt es unter „Kalender“ eine Monats-, Wochen- und Listenansicht aller Termine. Öffentliche Termine sieht jeder, und der Kalender lässt sich als iCal-Abo in die eigene Kalender-App übernehmen. Eingeloggte Mitglieder sehen zusätzlich interne Termine sowie Termine anderer Veranstalter, etwa geplante RDLs oder Veranstaltungen anderer Reservistenkameradschaften.

Neu ist auch: Ihr könnt im Kalender eure Abwesenheiten eintragen, zum Beispiel Urlaub oder Schichtdienst. Diese Einträge sehen nur ihr selbst und der Vorstand. Sie helfen uns, Termine so zu planen, dass möglichst viele teilnehmen können. Abwesenheiten werden 30 Tage nach ihrem Ende automatisch gelöscht.';

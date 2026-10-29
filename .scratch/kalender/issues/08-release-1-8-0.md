# 08 — Release 1.8.0 und News

Status: done

**What to build:** Version 1.8.0, News zur Kalender-Funktion per Datenmigration,
Dokumentation nachgezogen.

**Blocked by:** 01–07. (Ausgangsversion ist 1.7.1.)

- [x] `package.json` auf 1.8.0 (`lib/version-info.ts` wird beim Build per `scripts/generate-version.ts` erzeugt).
- [x] Migration mit `INSERT OR IGNORE` einer veröffentlichten News (feste ID, Klartext, vom
      Product Owner freigegebener Text); `MIGRATIONS.md`.
- [x] `TODO.md`, `README.md`, `AGENTS.md` (Kernseiten Kalender + Fremdtermine, Rollenrechte)
      aktualisiert.
- [x] `pnpm lint`, Typecheck und `pnpm test` (inkl. Coverage-Schwellen) grün.

## Freigegebener News-Text

**Titel:** Neu: Der Vereinskalender

Ab sofort gibt es unter „Kalender“ eine Monats-, Wochen- und Listenansicht aller Termine. Öffentliche Termine sieht jeder, und der Kalender lässt sich als iCal-Abo in die eigene Kalender-App übernehmen. Eingeloggte Mitglieder sehen zusätzlich interne Termine sowie Termine anderer Veranstalter, etwa geplante RDLs oder Veranstaltungen anderer Reservistenkameradschaften.

Neu ist auch: Ihr könnt im Kalender eure Abwesenheiten eintragen, zum Beispiel Urlaub oder Schichtdienst. Diese Einträge sehen nur ihr selbst sowie die Administratoren und Prüfer des Vereins. Sie helfen uns, Termine so zu planen, dass möglichst viele teilnehmen können. Abwesenheiten werden 30 Tage nach ihrem Ende automatisch gelöscht.

_Korrektur 19.10.2026 (vom Product Owner freigegeben):_ „… sehen nur ihr selbst und der
Vorstand“ ersetzt durch „… sehen nur ihr selbst sowie die Administratoren und Prüfer des
Vereins“ — Abwesenheiten sehen laut Rollenmodell ADMIN und AUDITOR, nicht ein „Vorstand“.
Die bereits auf `main` liegende Migration `20261022_news_vereinskalender` bleibt wegen der
Prüfsumme unverändert; die Korrektur kommt per Folgemigration
`20261023_news_vereinskalender_text` (`UPDATE` nur auf den unveränderten Originaltext, eine im
Adminbereich bearbeitete News bleibt erhalten).

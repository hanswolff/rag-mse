# Tasks

Legende: [ ] offen, [x] erledigt

- [ ] Im ersten Release nach 1.8.0: Spalte `Event.visible` samt Triggern `Event_visible_sync_insert`/`_update` per Migration entfernen und aus `schema.prisma` streichen (bis dahin nur für Image-Rollbacks auf den Stand vor 1.8.0, ADR 0008)
- [x] Administratoren verwalten Abwesenheiten anderer Benutzer: anlegen, ändern, löschen und umhängen, mit „Eingetragen von“ (`Absence.createdById`), Benutzerauswahl im Kalender und ergänzter Datenschutzerklärung; Prüfer bleibt lesend – siehe `.scratch/abwesenheiten-admin/` (Version 1.8.1)
- [x] Vereinskalender `/kalender` (Monat, Woche, Liste) mit Sichtbarkeitsstufe für Termine (öffentlich / nur für Mitglieder / verborgen), Fremdterminen (`/admin/fremdtermine`), Abwesenheiten (nur für sich selbst sowie Administratoren und Prüfer sichtbar, Löschung 30 Tage nach Ende), Kollisionshinweisen und öffentlichem iCal-Abo `/kalender.ics` – siehe `.scratch/kalender/` und ADR 0013 (Version 1.8.0)
- [x] Android-Startbildschirm-Icon über Manifest sowie transparente Launcher- und Maskable-Icons verbessert
- [x] Termin-Erinnerungen verwenden keinen berechneten Tageswert mehr im Benachrichtigungstext
- [x] Deployment-Selbsttest `GET /api/selftest` (zustandsfrei, Token-geschützt) – siehe `docs/SELFTEST.md`
- [x] Lehrgang als dritte Terminart mit optionalem Titel, Kosten und Plätzen sowie Belegungsanzeige für eingeloggte Benutzer – siehe `.scratch/lehrgang-als-terminart/` (Version 1.7.0)
- [x] Test-Harness-Ausbau: Selftest-Gate im Deploy (das Coverage-Gate wurde später aus Laufzeitgründen wieder aus `deploy.sh` genommen, siehe AGENTS.md), Integrationsschicht gegen echte SQLite (7 Kernflüsse, 177 Tests), HTTP-Smoke vor dem Umschalten, Playwright-Kernsuite (lokal) – siehe `.scratch/test-harness-ausbau/` und ADR 0010
- [x] Befund aus Issue 06 aufgeklärt: Der vermutete Kurzlink-Bug war ein Artefakt der Test-Factory – produktiv vergibt die Erstellungsroute 8-stellige IDs (`generatePollId()`), die das Regex der Kurzlink-Seite passieren. Factory und E2E-Fixture bilden das jetzt nach; das Regex akzeptiert zusätzlich bis 30 Zeichen, damit auch cuid-Altbestände auflösen (Positivtests in `__tests__/integration/06-umfrage-postausgang.test.ts`)
- [x] Befund aus Issue 04 behoben: Login lehnt nicht aktivierte Konten jetzt auch bei korrektem Passwort ab (Passwort- und Login-Proof-Pfad in `lib/auth-config.ts`); Site-Administratoren aktivieren sich weiterhin beim ersten Login selbst
- [x] Ausschreibungen lassen sich sichtbar und unsichtbar schalten: drei Sichtbarkeitsstufen (öffentlich / nur für Mitglieder / verborgen) statt eines Flags, wirksam bis auf den direkten PDF-Link, mit eigener Admin-Datei-Route für die Vorschau – siehe ADR 0011

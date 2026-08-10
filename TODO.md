# Tasks

Legende: [ ] offen, [x] erledigt

- [x] Android-Startbildschirm-Icon über Manifest sowie transparente Launcher- und Maskable-Icons verbessert
- [x] Termin-Erinnerungen verwenden keinen berechneten Tageswert mehr im Benachrichtigungstext
- [x] Deployment-Selbsttest `GET /api/selftest` (zustandsfrei, Token-geschützt) – siehe `docs/SELFTEST.md`
- [x] Lehrgang als dritte Terminart mit optionalem Titel, Kosten und Plätzen sowie Belegungsanzeige für eingeloggte Benutzer – siehe `.scratch/lehrgang-als-terminart/` (Version 1.7.0)
- [x] Test-Harness-Ausbau: Selftest- und Coverage-Gate im Deploy, Integrationsschicht gegen echte SQLite (7 Kernflüsse, 177 Tests), HTTP-Smoke vor dem Umschalten, Playwright-Kernsuite (lokal) – siehe `.scratch/test-harness-ausbau/` und ADR 0010
- [x] Befund aus Issue 06 aufgeklärt: Der vermutete Kurzlink-Bug war ein Artefakt der Test-Factory – produktiv vergibt die Erstellungsroute 8-stellige IDs (`generatePollId()`), die das Regex der Kurzlink-Seite passieren. Factory und E2E-Fixture bilden das jetzt nach; das Regex akzeptiert zusätzlich bis 30 Zeichen, damit auch cuid-Altbestände auflösen (Positivtests in `__tests__/integration/06-umfrage-postausgang.test.ts`)
- [x] Befund aus Issue 04 behoben: Login lehnt nicht aktivierte Konten jetzt auch bei korrektem Passwort ab (Passwort- und Login-Proof-Pfad in `lib/auth-config.ts`); Site-Administratoren aktivieren sich weiterhin beim ersten Login selbst

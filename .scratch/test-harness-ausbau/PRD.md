# Test-Harness-Ausbau: Gates schärfen, Realität statt Mocks testen

Status: done

Umgesetzt am 05.08.2026 — alle fünf Arbeitspakete (Issues 01–09). Neue Zahlen
nach dem Review desselben Tages: 148 Jest-Suiten / 2269 Tests (davon 5
Integrationssuiten mit 179 Tests gegen echte SQLite), 6 Playwright-Tests lokal.
Deploy-Gates neu: Coverage-Lauf über die gesamte Codebasis, HTTP-Smoke pre-switch,
Selftest post-deploy mit image-only-Rollback.

Zwei im Zuge der Arbeit gefundene Produktionsbefunde sind behoben: Login lehnt
nicht aktivierte Konten jetzt auch bei korrektem Passwort ab, und die
Kurzlink-Seite `/u/<code>` akzeptiert neben den 8-stelligen Kurz-IDs auch
cuid-Altbestände.

## Problem Statement

Änderungen an diesem Projekt entstehen oft „trocken“ — ohne die Anwendung lokal laufen zu
lassen — und gehen anschließend direkt über `deploy.sh` nach Produktion. Das Deploy-Skript
ist die einzige CI/CD-Pipeline (AGENTS.md); was seine Gates nicht fangen, fängt niemand.

Eine Bestandsaufnahme (05.08.2026) zeigt vier Lücken:

1. **Die Testsuite testet eine Simulation von Next.js, nicht Next.js.** `jest.setup.js`
   ersetzt `next/server` (`NextRequest`/`NextResponse`) global durch Eigenbau-Klassen,
   und praktisch alle API-Tests mocken den Prisma-Client weg. Getestet wird die
   Handler-Logik gegen Mocks — das echte Zusammenspiel Route → Prisma → SQLite-Schema
   bleibt ungeprüft. Genau die Fehlerklasse „Mock stimmt, Realität nicht“ (falsche
   Query, verletzter Unique-Constraint, abweichendes Next-Verhalten) rutscht durch.
2. **Kein Test gegen die echte gebaute App.** Der einzige Check gegen den laufenden
   Container ist der CSP-Header-Smoke-Check nach dem Umschalten. Ob Seiten rendern und
   Routen antworten, prüft vor dem Umschalten niemand.
3. **`/api/selftest` läuft nie automatisch.** Der tokengeschützte Tiefencheck
   (Datenbank, Migrationen, Stammdaten, E-Mail-Warteschlange) wurde genau für „nach dem
   Deploy“ gebaut (`docs/SELFTEST.md`), wird von `deploy.sh` aber nicht aufgerufen.
4. **Die Coverage-Schwellen sind zahnlos.** `jest.config.ts` fordert 80/70/70/80
   (Lines/Functions/Branches/Statements), aber `deploy.sh` ruft `pnpm test` ohne
   Coverage auf — Jest prüft `coverageThreshold` nur bei einem Coverage-Lauf. Die
   Schwellen sind dokumentierte Absicht ohne Durchsetzung.

## Solution

Fünf Arbeitspakete, in dieser Reihenfolge (kleinste Gates zuerst, das Projekt bleibt
nach jedem Schritt deploybar):

1. **Selftest als Post-Deploy-Gate** (Issue 01). `deploy.sh` ruft nach dem Healthcheck
   `/api/selftest` auf. Bei Status `error` (HTTP 503): Rollback `image-only` — die
   Datenbank bleibt unangetastet, da die App bereits healthy war (ADR 0008). Bei
   `warn`: Deploy gilt als erfolgreich, Warnungen werden ausgegeben.
2. **Coverage-Durchsetzung** (Issue 02). Das Test-Gate im Deploy läuft mit Coverage und
   erzwingt die Schwellen. Liegt der Ist-Stand darunter, werden die Schwellen einmalig
   auf den Ist-Stand gesetzt — das Gate verhindert ab dann Verschlechterung.
3. **Integrationsschicht gegen echte SQLite** (Issues 03–07, Kern der Arbeit). Eine
   zweite Testschicht: eigenes Jest-Projekt mit `node`-Environment, **ohne** die
   globalen Mocks, mit frischer SQLite-Datei pro Testlauf, echtem migriertem Schema und
   echtem Prisma-Client. Abgedeckt werden die sieben Kernflüsse mit dem höchsten
   Realitätsrisiko (Tokens, Unique-Constraints, Zustandsautomaten, Datumslogik) —
   siehe die Einzeltickets. Die Schicht läuft als Teil von `pnpm test` und damit
   automatisch im Deploy-Gate. Die bestehenden ~142 Mock-Testdateien bleiben
   unverändert (Begründung: ADR 0010).
4. **HTTP-Smoke pre-switch** (Issue 08). Vor dem Ersetzen des Prod-Containers startet
   `deploy.sh` den frisch gebauten Container mit Wegwerf-Datenbank auf einem Testport
   und prüft per HTTP: Startseite, öffentliche Seiten, öffentliche APIs, 404,
   Security-Header, `/api/health`. Nur bei Grün wird umgeschaltet.
5. **Playwright-Kernsuite** (Issue 09). 5–8 Browser-Tests gegen den lokal gestarteten
   Production-Build (Login, [[Teilnahmeanmeldung]] abgeben/zurückziehen, Admin legt
   [[Termin]] an, [[Umfrage]] abstimmen, öffentliche Seiten). Läuft **lokal und
   manuell** über `pnpm test:e2e` — bewusst kein Deploy-Gate (Browser-Binaries und
   Laufzeit gehören nicht auf den VPS-Deploy-Pfad).

### Entscheidungen (festgehalten 05.08.2026)

- Integrationsschicht: **ja**, alle sieben Kernflüsse in der ersten Ausbaustufe.
- Container-Smoke: **beides** — HTTP-Smoke als Deploy-Gate, Playwright nur lokal.
- Selftest im Deploy: **ja, mit Rollback** (`image-only` bei `error`).
- Coverage: **im Deploy erzwingen**; Schwellen ggf. auf Ist-Stand justieren.
- ADR: `docs/adr/0010-integrationstests-gegen-echte-sqlite.md`.

### Nicht Teil dieser Arbeit

- Umbau bestehender Mock-Tests auf die echte Datenbank.
- Playwright im Deploy-Gate oder auf dem VPS.
- Neue fachliche Funktionen; dieses Vorhaben ändert ausschließlich Test- und
  Deploy-Infrastruktur.

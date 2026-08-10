# 03 — Integrationsschicht: Infrastruktur mit echter SQLite

Status: done

Umsetzungsnotizen (05.08.2026): Parallelität gelöst über **eine frische SQLite pro
Testdatei** (mkdtemp in `setup/integration-env.ts`, Migrationen synchron via
exportiertem `runMigrations()`); parallel laufende Dateien teilen sich nichts.
Alle Test-Skripte laufen mit `TZ=Europe/Berlin` (Container-Zeitzone; Host ist UTC).
NextAuth-Session ist die einzige gemockte Systemgrenze der Schicht.

**What to build:** Eine zweite Testschicht, in der API-Routen gegen eine **echte**
SQLite-Datenbank laufen — echtes migriertes Schema, echter Prisma-Client, keine
globalen Mocks. Begründung und Abgrenzung: ADR 0010.

Zuschnitt:

- Eigenes Jest-Projekt (Jest-`projects` in `jest.config.ts`): Verzeichnis
  `__tests__/integration/`, `testEnvironment: "node"`, **ohne** `jest.setup.js`
  (dort werden `next/server` und `next-auth` global gemockt) — stattdessen ein
  eigenes, minimales Setup.
- Pro Testlauf eine frische SQLite-Datei (Temp-Verzeichnis), auf die alle
  Migrationen aus `prisma/migrations/` über den vorhandenen Migrations-Runner
  (ADR 0004, `scripts/run-db-migrations.ts`) angewendet werden. `DATABASE_URL`
  zeigt für die Dauer des Laufs auf diese Datei.
- Test-Factories (Aufbau analog `__tests__/helpers/factories.ts`) legen echte
  Datensätze an: [[Benutzer]] je [[Rolle]], [[Termin]], [[Umfrage]] mit Optionen,
  [[Einladung]], [[Standort]].
- Ein Hilfsmodul erzeugt echte Requests gegen die Route-Handler (App-Router-Module
  aus `app/api/…/route.ts` direkt importieren und mit echtem `Request`/`NextRequest`
  aufrufen) und setzt die Session über die vorhandenen Auth-Hilfen.
- Die Schicht läuft als Teil von `pnpm test` und damit im Deploy-Gate; einzeln
  startbar über `pnpm test:integration`.

**Blocked by:** None — can start immediately. Blockiert die Issues 04–07.

- [x] `pnpm test` führt beide Schichten aus; `pnpm test:integration` nur die neue.
- [x] Die Unit-Schicht bleibt unverändert grün (globale Mocks gelten dort weiter).
- [x] Ein Pilot-Integrationstest legt über eine Factory einen Benutzer in der
      echten SQLite an, ruft eine echte Route auf und liest das Ergebnis aus der
      Datenbank zurück.
- [x] Zwei parallel laufende Testdateien kommen sich nicht in die Quere (getrennte
      DB-Dateien oder serielle Ausführung — bewusst entscheiden und dokumentieren).
- [x] Der Aufbau ist in AGENTS.md kurz beschrieben (welche Schicht wofür).

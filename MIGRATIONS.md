# Datenbank-Migrationen

Die Anwendung nutzt eine idempotente SQL-Migrationskette unter
`prisma/migrations/*/migration.sql` und speichert den Anwendungsstand in der
Tabelle `_AppMigration`.

## Initiale Datenbank erstellen

1. Leere SQLite-Datei anlegen oder nur `DATABASE_URL` auf einen noch nicht vorhandenen Pfad zeigen lassen.
2. Migrationsskript ausführen:

```bash
DATABASE_URL=file:/tmp/rag-mse-dev.db pnpm run db:migrate
```

Das Skript initialisiert bei einer frischen Datenbank zuerst die Baseline aus
`prisma/baseline.sql` und wendet anschließend alle fehlenden Migrationen aus
`prisma/migrations` an. `prisma/baseline.sql` ist eine interne Bootstrap-Baseline
und muss im Regelfall nicht manuell ausgeführt werden.

## Schema ändern (Entwicklung)

1. `prisma/schema.prisma` aktualisieren.
2. Neue SQL-Migration als eigenes Verzeichnis unter `prisma/migrations` anlegen.
3. Migration anwenden:

```bash
DATABASE_URL=file:/tmp/rag-mse-dev.db pnpm run db:migrate
```

4. Optional lokale Entwicklungs-DB direkt mit Prisma synchronisieren:

```bash
pnpm run db:push
```

## Produktion

- Beim Containerstart führt `entrypoint.sh` automatisch
  `node scripts-dist/scripts/run-db-migrations.js` aus (das vorkompilierte
  Pendant zu `pnpm run db:migrate`; im Runtime-Image gibt es kein pnpm).
- Die Datenbankdatei heißt `data/prod.db`. Historisch hieß die Produktions-DB
  `dev.db`; findet `entrypoint.sh` beim ersten Start nach der Umbenennung keine
  `prod.db`, aber eine `dev.db` im selben Verzeichnis, wird sie automatisch
  einmalig in `prod.db` umbenannt.
- Bei einer leeren Datenbank wird dabei zuerst die Baseline geladen; bei
  bestehenden Datenbanken werden nur fehlende Migrationen angewendet.
- Migrationen sind versionsgeführt und werden nur einmal angewendet.
- Bereits angewendete Migrationen mit verändertem Inhalt werden erkannt und
  brechen mit Fehler ab, um Dateninkonsistenzen zu verhindern.

## Migrationshistorie

### 20261030_absence_created_by

Ergänzt die Tabelle `Absence` (Abwesenheit) um `createdById` („eingetragen von“, nullable,
`ON DELETE SET NULL`). Prisma-Standardmuster für SQLite: Tabelle neu anlegen, Daten
kopieren, umbenennen; die Indizes auf `userId`, `startDate` und `endDate` werden neu erzeugt.

**Zweck:** Administratoren können Abwesenheiten für andere Benutzer eintragen; die
Abwesenheit weist aus, wer sie eingetragen hat (siehe `CONTEXT.md`, Abwesenheit).

**Backfill:** `createdById = userId` für alle bestehenden Abwesenheiten — bisher konnte nur
der Benutzer selbst eintragen.

**Rollback:** Läuft nach dieser Migration wieder das Image 1.8.0, legt der alte Code
Abwesenheiten mit `createdById = NULL` an. Nach dem erneuten Vorwärts-Deploy erscheinen sie
als „Eingetragen von einem Administrator“, obwohl der Benutzer sie selbst eingetragen hat.
Korrektur nach dem Vorwärts-Deploy (Rollback-Zeitpunkt in UTC einsetzen; `createdAt` steht
als ISO-8601-Text in UTC in der Datenbank, der Textvergleich ist daher zeitlich korrekt):

```sql
UPDATE "Absence" SET "createdById" = "userId"
WHERE "createdById" IS NULL AND "createdAt" >= '2026-11-02T18:00:00';
```

Achtung: Die Bedingung erfasst auch Abwesenheiten, die ein Administrator in diesem Zeitraum
eingetragen und deren Konto inzwischen gelöscht wurde (ebenfalls `NULL`) — vorher prüfen.

### 20261023_news_vereinskalender_text

Reine Datenmigration: korrigiert in der Release-News `news-vereinskalender-1-8-0` den Satz
„Diese Einträge sehen nur ihr selbst und der Vorstand.“ zu „… sowie die Administratoren und
Prüfer des Vereins.“ (vom Product Owner freigegeben, 19.10.2026) und setzt `updatedAt` auf den
Zeitpunkt des Laufs. Die Migration `20261022_news_vereinskalender` bleibt wegen der
Prüfsumme in `_AppMigration` unverändert.

**Backfill:** Keiner. Das `UPDATE` greift nur, wenn `content` noch exakt dem Originaltext
entspricht; eine im Adminbereich bearbeitete oder gelöschte News bleibt unverändert.

### 20261022_news_vereinskalender

Reine Datenmigration (Release 1.8.0): legt per `INSERT OR IGNORE` die veröffentlichte
News „Neu: Der Vereinskalender“ mit fester ID `news-vereinskalender-1-8-0` an
(Klartext, `published = 1`). `newsDate`, `createdAt` und `updatedAt` sind der Zeitpunkt
des Migrationslaufs (Deployment), per `strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now')` im
Format des Prisma-SQLite-Adapters (ISO 8601 in UTC).

**Zweck:** Mitglieder und Besucher über Kalender, Fremdtermine, iCal-Abo und
Abwesenheiten informieren.

**Backfill:** Keiner. Feste ID und `INSERT OR IGNORE` verhindern nur Duplikate. Dass eine
im Adminbereich bearbeitete oder gelöschte News nicht wiederkommt, liegt am Eintrag in
`_AppMigration` (die Migration läuft nur einmal); wird dieser Eintrag entfernt, legt ein
erneuter Lauf eine gelöschte News wieder an.

### 20261021_add_absence

Legt die Tabelle `Absence` (Abwesenheit) mit Indizes auf `userId`, `startDate` und
`endDate` an. Felder: `userId` (`ON DELETE CASCADE`), Zeitraum `startDate`/`endDate`
(lokales Datum wie beim Fremdtermin), `allDay` (Default `true`), `timeFrom`/`timeTo`
(`HH:MM`, nur ohne `allDay`), `reason` (optional, max. 200 Zeichen, in der API geprüft).

**Zweck:** Benutzer tragen eigene Nichtverfügbarkeit ein; Kollisionshinweis für die
Terminplanung — siehe `docs/adr/0013-fremdtermin-und-abwesenheit-als-eigene-modelle.md`.
Der Maintenance-Worker löscht Abwesenheiten 30 Tage nach `endDate`.

**Backfill:** Keiner (neue Tabelle).

### 20261020_add_external_event

Legt die Tabelle `ExternalEvent` (Fremdtermin) mit Indizes auf `startDate` und `endDate`
an. Felder: `title`, Zeitraum `startDate`/`endDate` (lokales Datum wie beim Termin),
`allDay` (Default `true`), `timeFrom`/`timeTo` (`HH:MM`, nur ohne `allDay`), `location`,
`description`, `url`, `kind` (`RDL` | `RK_EVENT` | `COMPETITION` | `OTHER`, optional),
`visibility` (Default `MEMBER`), `ausschreibungId` und `createdById` (beide
`ON DELETE SET NULL`).

**Zweck:** Termine Dritter im Adminbereich pflegen und im Kalender anzeigen — siehe
`docs/adr/0013-fremdtermin-und-abwesenheit-als-eigene-modelle.md`.

**Backfill:** Keiner (neue Tabelle).

### 20261019_event_visibility

Ersetzt das Feld `visible Boolean` der Tabelle `Event` durch `visibility`
(`PUBLIC` | `MEMBER` | `HIDDEN`, Default `PUBLIC`) und entfernt die Spalte `visible`.
Das Prisma-Enum `AusschreibungVisibility` heißt jetzt gemeinsam `Visibility`; da SQLite
Enums als Text speichert, ändert sich an der Tabelle `Ausschreibung` nichts.

**Zweck:** Sichtbarkeitsstufe des Termins (öffentlich / nur für Mitglieder / verborgen),
wie bei der Ausschreibung — siehe `docs/adr/0011-sichtbarkeitsstufen-der-ausschreibung.md`.

**Backfill:** `visible = 0` wird `HIDDEN`, alle übrigen Termine werden `PUBLIC`.

**Hinweis:** Wurde eine Datenbank per `db push` bereits auf `visibility` gebracht, kann der
Runner das `DROP COLUMN` nicht als erfüllt erkennen und bricht ab. Dann den Eintrag
`20261019_event_visibility` samt Prüfsumme (SHA-256 der `migration.sql`) manuell in
`_AppMigration` einfügen.

### 20260829_add_ausschreibung_visibility

Fügt das Feld `visibility` (`PUBLIC` | `MEMBER` | `HIDDEN`, Default `PUBLIC`) zur
Tabelle `Ausschreibung` hinzu.

**Zweck:** Sichtbarkeitsstufen der Ausschreibung (öffentlich / nur für Mitglieder /
verborgen) — siehe `docs/adr/0011-sichtbarkeitsstufen-der-ausschreibung.md`.

**Backfill:** Über den Spalten-Default — alle Bestands-Ausschreibungen waren
öffentlich und werden `PUBLIC`.

### 20260804_add_event_capacity

Fügt das Feld `capacity Int?` zur Tabelle `Event` hinzu.

**Zweck:** Optionale Platzzahl eines Termins. Sie ist ausdrücklich informativ und
sperrt keine Teilnahmeanmeldung — siehe
`docs/adr/0003-platzzahl-ist-informativ-und-sperrt-keine-anmeldung.md`.

**Backfill:** Keiner.

### 20260804_add_event_cost

Fügt das Feld `cost String?` zur Tabelle `Event` hinzu.

**Zweck:** Optionale Kostenangabe als kurzer Freitext („25 € für Mitglieder, 40 € für
Gäste“, „kostenfrei“). Bewusst kein Betragsfeld: Staffelungen nach Mitglied/Gast wären
sonst nicht abbildbar und der Wert „0“ mehrdeutig.

**Backfill:** Keiner.

### 20260804_add_event_title

Fügt das Feld `title String?` zur Tabelle `Event` hinzu.

**Zweck:** Optionaler Titel eines Termins („Dynamisches Pistolenschießen Level 1“).
Wo kein Titel gesetzt ist, bleibt das Datum die Überschrift.

**Backfill:** Keiner — Bestandstermine bleiben bewusst ohne Titel.

### 20260709_fix_schema_drift

Bereinigt Abweichungen zwischen `schema.prisma` und real ausgerollten Datenbanken:

- `User.name` ist nullable (die Baseline hatte `NOT NULL`); `hasPossessionCard` als
  `BOOLEAN DEFAULT false`.
- `Poll` verliert die nur in der Datenbank vorhandenen CHECK-Constraints und den
  Spalten-Default `'SONSTIGES'` — beides ist in `schema.prisma` nicht abbildbar,
  Enum-Werte erzwingt der Prisma-Client.
- `News.newsDate` ist auf allen Installationspfaden `NOT NULL` (mit Backfill aus
  `createdAt` für Alt-Datenbanken).
- Der in `schema.prisma` deklarierte Index `Invitation_email_usedAt_idx` wird angelegt.

Ein Test in `__tests__/run-db-migrations.test.ts` spielt die Migrationskette in eine
frische Datenbank ein und erzwingt, dass `prisma migrate diff` gegen `schema.prisma`
leer bleibt.

### 20260413_add_activated_at

Fügt das Feld `activatedAt DateTime?` zur Tabelle `User` hinzu.

**Zweck:** Explizites Aktivierungsdatum, das **ausschließlich** beim Einlösen einer
Einladung gesetzt wird. Ersetzt `passwordUpdatedAt` als Aktivierungsindikator
(dieses Feld wird weiterhin für Audit-Zwecke gepflegt, zeigt aber den Zeitpunkt
der letzten Passwortänderung, nicht die Kontoaktivierung).

**Backfill:** Für alle Benutzer mit vorhandenem `passwordUpdatedAt` wird
`activatedAt = passwordUpdatedAt` gesetzt, da diese Benutzer ihre Einladung bereits
eingelöst haben.

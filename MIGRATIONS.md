# Datenbank-Migrationen

Die Anwendung nutzt eine idempotente SQL-Migrationskette unter
`prisma/migrations/*/migration.sql` und speichert den Anwendungsstand in der
Tabelle `_AppMigration`.

## Initiale Datenbank erstellen

1. Leere SQLite-Datei anlegen oder nur `DATABASE_URL` auf einen noch nicht vorhandenen Pfad zeigen lassen.
2. Migrationsskript ausführen:

```bash
pnpm run db:migrate
```

Das Skript initialisiert bei einer frischen Datenbank zuerst die Baseline aus
`create_admin.sql` und wendet anschließend alle fehlenden Migrationen aus
`prisma/migrations` an. `create_admin.sql` ist eine interne Bootstrap-Baseline
und muss im Regelfall nicht manuell ausgeführt werden.

## Schema ändern (Entwicklung)

1. `prisma/schema.prisma` aktualisieren.
2. Neue SQL-Migration als eigenes Verzeichnis unter `prisma/migrations` anlegen.
3. Migration anwenden:

```bash
pnpm run db:migrate
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

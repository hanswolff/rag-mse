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

- Beim Containerstart wird automatisch `pnpm run db:migrate` ausgeführt.
- Bei einer leeren Datenbank wird dabei zuerst die Baseline geladen; bei
  bestehenden Datenbanken werden nur fehlende Migrationen angewendet.
- Migrationen sind versionsgeführt und werden nur einmal angewendet.
- Bereits angewendete Migrationen mit verändertem Inhalt werden erkannt und
  brechen mit Fehler ab, um Dateninkonsistenzen zu verhindern.

## Migrationshistorie

### 20260413_add_activated_at

Fügt das Feld `activatedAt DateTime?` zur Tabelle `User` hinzu.

**Zweck:** Explizites Aktivierungsdatum, das **ausschließlich** beim Einlösen einer
Einladung gesetzt wird. Ersetzt `passwordUpdatedAt` als Aktivierungsindikator
(dieses Feld wird weiterhin für Audit-Zwecke gepflegt, zeigt aber den Zeitpunkt
der letzten Passwortänderung, nicht die Kontoaktivierung).

**Backfill:** Für alle Nutzer mit vorhandenem `passwordUpdatedAt` wird
`activatedAt = passwordUpdatedAt` gesetzt, da diese Nutzer ihre Einladung bereits
eingelöst haben.

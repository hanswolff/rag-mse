# Datenbank-Migrationen

Die Anwendung nutzt eine idempotente SQL-Migrationskette unter
`prisma/migrations/*/migration.sql` und speichert den Anwendungsstand in der
Tabelle `_AppMigration`.

## Initiale Datenbank erstellen

1. Leere SQLite-Datei anlegen (z. B. `./data/dev.db`).
2. Initial-Skript ausführen:

```bash
sqlite3 ./data/dev.db < create_admin.sql
```

3. Danach optional die Migrationskette laufen lassen (sollte bei frischer DB
   keine weiteren Änderungen mehr vornehmen):

```bash
pnpm run db:migrate
```

## Schema ändern (Entwicklung)

1. `prisma/schema.prisma` aktualisieren.
2. Neue SQL-Migration als eigenes Verzeichnis unter `prisma/migrations` anlegen.
3. Migration anwenden:

```bash
pnpm run db:migrate
```

4. Optional lokale Entwicklungs-DB mit Prisma synchronisieren:

```bash
pnpm run db:push
```

## Produktion

- Beim Containerstart wird automatisch `pnpm run db:migrate` ausgeführt.
- Migrationen sind versionsgeführt und werden nur einmal angewendet.
- Bereits angewendete Migrationen mit verändertem Inhalt werden erkannt und
  brechen mit Fehler ab, um Dateninkonsistenzen zu verhindern.

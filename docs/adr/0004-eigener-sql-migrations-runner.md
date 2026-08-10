# Eigener idempotenter SQL-Migrations-Runner statt `prisma migrate deploy`

Die Datenbank wird von `scripts/run-db-migrations.ts` migriert: Der Runner liest
`prisma/migrations/*/migration.sql`, führt fehlende Migrationen aus und schreibt den
Stand in die Tabelle `_AppMigration`. `prisma migrate deploy` und dessen Tabelle
`_prisma_migrations` kommen nicht zum Einsatz.

Der Runner ist bewusst **idempotent auf Statement-Ebene**: Er erkennt bereits erfüllte
Schema-Statements (`ALTER TABLE … ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`,
`DROP INDEX IF EXISTS`) und behandelt sie als angewendet, statt abzubrechen. Damit
lassen sich Datenbanken einsammeln, die per `prisma db push` oder von Hand
weitergedreht wurden.

## Considered Options

- **Gewählt: eigener Runner.** Er kommt ohne die Prisma-CLI im Laufzeit-Image aus
  (`entrypoint.sh` ruft das vorkompilierte `scripts-dist/scripts/run-db-migrations.js`;
  im Runtime-Image gibt es kein pnpm), verträgt vorhandene Datenbanken mit Drift und
  kann eine leere Datei zuerst aus der Baseline `create_admin.sql` initialisieren.
- **Verworfen: `prisma migrate deploy`.** Es hätte die Prisma-CLI plus Engine im Image
  erzwungen und wäre an jeder Abweichung zwischen `_prisma_migrations` und dem realen
  Schema hart gescheitert — bei einer über Monate von Hand gepflegten SQLite-Datei der
  wahrscheinliche Normalfall. Ein „Baseline nachziehen“ von Hand wäre bei jedem
  Umgebungswechsel nötig geworden.
- **Verworfen: gar keine Migrationen, nur `prisma db push`.** Kein Verlauf, keine
  Wiederholbarkeit, kein Schutz vor Datenverlust bei Spaltenumbenennungen.

## Consequences

- Migrationen sind einfache SQL-Dateien; wer eine schreibt, muss sie selbst
  idempotenzfähig halten (siehe `MIGRATIONS.md`).
- Bereits angewendete Migrationen mit **verändertem Inhalt** brechen mit Fehler ab —
  eine ausgelieferte Migration darf nicht nachträglich editiert werden.
- Der Abgleich mit `schema.prisma` ist nicht automatisch gegeben, deshalb erzwingt
  `__tests__/run-db-migrations.test.ts` ihn: Die Kette wird in eine frische Datenbank
  eingespielt und `prisma migrate diff` muss leer bleiben. Dieser Test ist die
  eigentliche Absicherung dieser Entscheidung.
- Prisma bleibt für Client-Generierung und `db push` in der Entwicklung im Einsatz;
  nur das Ausrollen läuft am Prisma-Migrationsmechanismus vorbei.

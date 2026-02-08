import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import Database from "better-sqlite3";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

function resolveSqlitePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Nur SQLite file:-URLs werden unterstützt: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice(5);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function listMigrationEntries(): Array<{ name: string; sql: string; checksum: string }> {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return folders.map(name => {
    const migrationPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
    const sql = readFileSync(migrationPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    return { name, sql, checksum };
  });
}

function run(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./data/dev.db";
  const dbPath = resolveSqlitePath(databaseUrl);
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS "_AppMigration" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedStmt = db.prepare('SELECT "name", "checksum" FROM "_AppMigration" WHERE "name" = ?');
  const insertStmt = db.prepare('INSERT INTO "_AppMigration" ("name", "checksum") VALUES (?, ?)');

  const migrations = listMigrationEntries();

  for (const migration of migrations) {
    const applied = appliedStmt.get(migration.name) as { name: string; checksum: string } | undefined;

    if (applied) {
      if (applied.checksum !== migration.checksum) {
        throw new Error(`Migration ${migration.name} wurde bereits mit anderem Inhalt angewendet.`);
      }
      continue;
    }

    const tx = db.transaction(() => {
      db.exec(migration.sql);
      insertStmt.run(migration.name, migration.checksum);
    });

    tx();
    console.log(`Migration angewendet: ${migration.name}`);
  }

  db.close();
}

run();

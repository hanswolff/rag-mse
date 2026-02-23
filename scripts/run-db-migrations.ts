#!/usr/bin/env node

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

interface MigrationEntry {
  name: string;
  sql: string;
  checksum: string;
}

interface SqliteErrorLike {
  code?: string;
  message?: string;
}

type SqliteDatabase = InstanceType<typeof Database>;

function listMigrationEntries(): MigrationEntry[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return folders.map((name) => {
    const migrationPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
    const sql = readFileSync(migrationPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    return { name, sql, checksum };
  });
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function hasColumn(db: SqliteDatabase, tableName: string, columnName: string): boolean {
  const quotedTable = quoteIdentifier(tableName);
  const rows = db.prepare(`PRAGMA table_info(${quotedTable});`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function tableExists(db: SqliteDatabase, tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;")
    .get(tableName);
  return Boolean(row);
}

function indexExists(db: SqliteDatabase, indexName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1;")
    .get(indexName);
  return Boolean(row);
}

function canTreatMigrationAsAlreadyApplied(
  db: SqliteDatabase,
  migration: MigrationEntry,
  error: unknown
): boolean {
  const sqliteError = error as SqliteErrorLike;
  const message = sqliteError?.message ?? "";

  if (sqliteError?.code !== "SQLITE_ERROR") {
    return false;
  }

  const duplicateColumnMatch = message.match(/duplicate column name:\s*"?([A-Za-z0-9_]+)"?/i);
  if (duplicateColumnMatch) {
    const columnName = duplicateColumnMatch[1];
    const addColumnRegex =
      /ALTER\s+TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD\s+COLUMN\s+"?([A-Za-z0-9_]+)"?/gi;
    for (const match of migration.sql.matchAll(addColumnRegex)) {
      const tableName = match[1];
      const statementColumnName = match[2];
      if (statementColumnName === columnName && hasColumn(db, tableName, columnName)) {
        return true;
      }
    }
    return false;
  }

  if (/table\s+["`']?[A-Za-z0-9_]+["`']?\s+already exists/i.test(message)) {
    const createTableRegex = /CREATE\s+TABLE\s+"?([A-Za-z0-9_]+)"?/i;
    const match = migration.sql.match(createTableRegex);
    if (!match) {
      return false;
    }
    return tableExists(db, match[1]);
  }

  if (/index\s+["`']?[A-Za-z0-9_]+["`']?\s+already exists/i.test(message)) {
    const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"?([A-Za-z0-9_]+)"?/i;
    const match = migration.sql.match(createIndexRegex);
    if (!match) {
      return false;
    }
    return indexExists(db, match[1]);
  }

  return false;
}

function run(): void {
  const databaseUrl = process.env.DATABASE_URL || "file:./data/dev.db";
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

    try {
      tx();
      console.log(`Migration angewendet: ${migration.name}`);
    } catch (error) {
      if (!canTreatMigrationAsAlreadyApplied(db, migration, error)) {
        throw error;
      }

      insertStmt.run(migration.name, migration.checksum);
      console.warn(
        `Migration als bereits angewendet markiert (Schema bereits vorhanden): ${migration.name}`
      );
    }
  }

  db.close();
}

run();

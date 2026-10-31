import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import {
  areSchemaStatementsAlreadySatisfied,
  extractDataStatements,
  isMigrationSchemaAlreadySatisfied,
  needsBaselineInitialization,
  runDataStatementsForSatisfiedMigration,
  splitSqlStatements,
} from "../scripts/run-db-migrations";

describe("run-db-migrations helpers", () => {
  it("splits SQL into executable statements and strips line comments", () => {
    const sql = `
      -- comment
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
      ALTER TABLE "User" ADD COLUMN "name" TEXT; -- inline comment
    `;

    expect(splitSqlStatements(sql)).toEqual([
      'CREATE TABLE "User" ("id" TEXT PRIMARY KEY)',
      'ALTER TABLE "User" ADD COLUMN "name" TEXT',
    ]);
  });

  it("keeps semicolons and comment markers inside string literals", () => {
    const sql = `
      CREATE TABLE "Example" ("id" TEXT PRIMARY KEY, "note" TEXT);
      INSERT INTO "Example" ("id", "note") VALUES ('1', 'value;with;semicolon -- still text');
      INSERT INTO "Example" ("id", "note") VALUES ('2', "quoted;identifier");
    `;

    expect(splitSqlStatements(sql)).toEqual([
      'CREATE TABLE "Example" ("id" TEXT PRIMARY KEY, "note" TEXT)',
      `INSERT INTO "Example" ("id", "note") VALUES ('1', 'value;with;semicolon -- still text')`,
      `INSERT INTO "Example" ("id", "note") VALUES ('2', "quoted;identifier")`,
    ]);
  });

  it("returns true only when all schema statements are already satisfied", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "firstName" TEXT,
        "lastName" TEXT
      );
      CREATE INDEX "User_firstName_idx" ON "User"("firstName");
    `);

    const sql = `
      ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
      ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
      CREATE INDEX "User_firstName_idx" ON "User"("firstName");
    `;

    expect(isMigrationSchemaAlreadySatisfied(db, sql)).toBe(true);
    db.close();
  });

  it("returns false when migration contains data-manipulation statements", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT
      );
    `);

    const sql = `
      ALTER TABLE "User" ADD COLUMN "name" TEXT;
      UPDATE "User" SET "name" = 'A';
    `;

    expect(isMigrationSchemaAlreadySatisfied(db, sql)).toBe(false);
    db.close();
  });

  it("can treat schema statements as satisfied even when migration also contains data updates", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "News" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "createdAt" DATETIME NOT NULL,
        "newsDate" DATETIME
      );
      CREATE INDEX "News_newsDate_idx" ON "News"("newsDate");
    `);

    const sql = `
      ALTER TABLE "News" ADD COLUMN "newsDate" DATETIME;
      UPDATE "News" SET "newsDate" = "createdAt" WHERE "newsDate" IS NULL;
      CREATE INDEX IF NOT EXISTS "News_newsDate_idx" ON "News"("newsDate");
    `;

    expect(areSchemaStatementsAlreadySatisfied(db, sql)).toBe(true);
    expect(isMigrationSchemaAlreadySatisfied(db, sql)).toBe(false);
    db.close();
  });

  it("extracts only non-schema statements as data statements", () => {
    const sql = `
      ALTER TABLE "User" ADD COLUMN "activatedAt" DATETIME;
      UPDATE "User" SET "activatedAt" = "passwordUpdatedAt" WHERE "passwordUpdatedAt" IS NOT NULL;
      CREATE INDEX "User_activatedAt_idx" ON "User"("activatedAt");
    `;

    expect(extractDataStatements(sql)).toEqual([
      'UPDATE "User" SET "activatedAt" = "passwordUpdatedAt" WHERE "passwordUpdatedAt" IS NOT NULL',
    ]);
  });

  it("runs data backfills when schema statements were already satisfied", () => {
    // Simuliert eine per `db push` erzeugte Spalte: das ALTER TABLE der Migration
    // schlägt fehl, aber das UPDATE-Backfill muss trotzdem ausgeführt werden.
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "passwordUpdatedAt" DATETIME,
        "activatedAt" DATETIME
      );
      INSERT INTO "User" ("id", "passwordUpdatedAt") VALUES ('u1', '2026-01-01 10:00:00');
      INSERT INTO "User" ("id") VALUES ('u2');
    `);

    const migrationSql = `
      ALTER TABLE "User" ADD COLUMN "activatedAt" DATETIME;
      UPDATE "User" SET "activatedAt" = "passwordUpdatedAt" WHERE "passwordUpdatedAt" IS NOT NULL;
    `;

    const executed = runDataStatementsForSatisfiedMigration(db, migrationSql);

    expect(executed).toBe(1);
    expect(db.prepare(`SELECT "activatedAt" FROM "User" WHERE "id" = 'u1'`).get()).toEqual({
      activatedAt: "2026-01-01 10:00:00",
    });
    expect(db.prepare(`SELECT "activatedAt" FROM "User" WHERE "id" = 'u2'`).get()).toEqual({
      activatedAt: null,
    });
    db.close();
  });

  it("backfills Absence.createdById with the owner and nulls it when the creator is deleted", () => {
    const migrationSql = (name: string) =>
      readFileSync(path.join(__dirname, "..", "prisma", "migrations", name, "migration.sql"), "utf8");
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);`);
    db.exec(migrationSql("20261021_add_absence"));
    db.exec(`
      INSERT INTO "User" ("id") VALUES ('owner'), ('admin');
      INSERT INTO "Absence" ("id", "userId", "startDate", "endDate", "reason", "updatedAt")
        VALUES ('a1', 'owner', '2026-11-01', '2026-11-02', 'Urlaub', '2026-10-30');
    `);

    db.exec(migrationSql("20261030_absence_created_by"));

    expect(db.prepare(`SELECT "userId", "createdById", "reason" FROM "Absence"`).all()).toEqual([
      { userId: "owner", createdById: "owner", reason: "Urlaub" },
    ]);
    db.pragma("foreign_keys = ON");
    db.exec(`UPDATE "Absence" SET "createdById" = 'admin'; DELETE FROM "User" WHERE "id" = 'admin';`);
    expect(db.prepare(`SELECT "userId", "createdById" FROM "Absence"`).all()).toEqual([
      { userId: "owner", createdById: null },
    ]);
    db.close();
  });

  it("replayed migration chain matches schema.prisma without drift", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const binDir = path.join(repoRoot, "node_modules", ".bin");
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "migration-drift-"));
    const databaseUrl = `file:${path.join(tempDir, "drift.db")}`;

    try {
      const migrate = spawnSync(path.join(binDir, "tsx"), ["scripts/run-db-migrations.ts"], {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: "utf8",
        timeout: 90_000,
      });
      expect(migrate.status).toBe(0);

      const diff = spawnSync(
        path.join(binDir, "prisma"),
        ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"],
        {
          cwd: repoRoot,
          env: { ...process.env, DATABASE_URL: databaseUrl },
          encoding: "utf8",
          timeout: 90_000,
        }
      );
      // Exit-Code 0 = kein Drift, 2 = Drift vorhanden (stdout zeigt dann die Abweichungen).
      expect(diff.stdout).toContain("No difference detected");
      expect(diff.status).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 120_000);

  it("detects when baseline initialization is required", () => {
    const emptyDb = new Database(":memory:");
    expect(needsBaselineInitialization(emptyDb)).toBe(true);
    emptyDb.close();

    const initializedDb = new Database(":memory:");
    initializedDb.exec(`
      CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
    `);
    expect(needsBaselineInitialization(initializedDb)).toBe(false);
    initializedDb.close();
  });
});

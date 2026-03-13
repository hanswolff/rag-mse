import Database from "better-sqlite3";
import {
  areSchemaStatementsAlreadySatisfied,
  isMigrationSchemaAlreadySatisfied,
  needsBaselineInitialization,
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

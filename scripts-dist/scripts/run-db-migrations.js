#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitSqlStatements = splitSqlStatements;
exports.areSchemaStatementsAlreadySatisfied = areSchemaStatementsAlreadySatisfied;
exports.isMigrationSchemaAlreadySatisfied = isMigrationSchemaAlreadySatisfied;
exports.extractDataStatements = extractDataStatements;
exports.runDataStatementsForSatisfiedMigration = runDataStatementsForSatisfiedMigration;
exports.needsBaselineInitialization = needsBaselineInitialization;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const MIGRATIONS_DIR = path_1.default.join(process.cwd(), "prisma", "migrations");
const BASELINE_SQL_PATH = path_1.default.join(process.cwd(), "create_admin.sql");
function resolveSqlitePath(databaseUrl) {
    if (!databaseUrl.startsWith("file:")) {
        throw new Error(`Nur SQLite file:-URLs werden unterstützt: ${databaseUrl}`);
    }
    const rawPath = databaseUrl.slice(5);
    return path_1.default.isAbsolute(rawPath) ? rawPath : path_1.default.resolve(process.cwd(), rawPath);
}
function splitSqlStatements(sql) {
    const statements = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let index = 0; index < sql.length; index += 1) {
        const char = sql[index];
        const nextChar = sql[index + 1];
        if (inLineComment) {
            if (char === "\n") {
                inLineComment = false;
            }
            continue;
        }
        if (inBlockComment) {
            if (char === "*" && nextChar === "/") {
                inBlockComment = false;
                index += 1;
            }
            continue;
        }
        if (!inSingleQuote && !inDoubleQuote) {
            if (char === "-" && nextChar === "-") {
                inLineComment = true;
                index += 1;
                continue;
            }
            if (char === "/" && nextChar === "*") {
                inBlockComment = true;
                index += 1;
                continue;
            }
        }
        if (char === "'" && !inDoubleQuote) {
            if (inSingleQuote && nextChar === "'") {
                current += "''";
                index += 1;
                continue;
            }
            inSingleQuote = !inSingleQuote;
            current += char;
            continue;
        }
        if (char === '"' && !inSingleQuote) {
            if (inDoubleQuote && nextChar === '"') {
                current += "\"\"";
                index += 1;
                continue;
            }
            inDoubleQuote = !inDoubleQuote;
            current += char;
            continue;
        }
        if (char === ";" && !inSingleQuote && !inDoubleQuote) {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                statements.push(trimmed);
            }
            current = "";
            continue;
        }
        current += char;
    }
    const trailing = current.trim();
    if (trailing.length > 0) {
        statements.push(trailing);
    }
    return statements;
}
function listMigrationEntries() {
    if (!(0, fs_1.existsSync)(MIGRATIONS_DIR)) {
        return [];
    }
    const folders = (0, fs_1.readdirSync)(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    return folders.map((name) => {
        const migrationPath = path_1.default.join(MIGRATIONS_DIR, name, "migration.sql");
        const sql = (0, fs_1.readFileSync)(migrationPath, "utf8");
        const checksum = (0, crypto_1.createHash)("sha256").update(sql).digest("hex");
        return { name, sql, checksum };
    });
}
function quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, "\"\"")}"`;
}
function hasColumn(db, tableName, columnName) {
    const quotedTable = quoteIdentifier(tableName);
    const rows = db.prepare(`PRAGMA table_info(${quotedTable});`).all();
    return rows.some((row) => row.name === columnName);
}
function tableExists(db, tableName) {
    const row = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;")
        .get(tableName);
    return Boolean(row);
}
function indexExists(db, indexName) {
    const row = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1;")
        .get(indexName);
    return Boolean(row);
}
function isSchemaStatement(statement) {
    return /^(ALTER\s+TABLE|CREATE\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+INDEX)/i.test(statement);
}
function areSchemaStatementsAlreadySatisfied(db, migrationSql) {
    const schemaStatements = splitSqlStatements(migrationSql).filter(isSchemaStatement);
    if (schemaStatements.length === 0) {
        return false;
    }
    return schemaStatements.every((statement) => isStatementAlreadySatisfied(db, statement));
}
function isStatementAlreadySatisfied(db, statement) {
    const addColumnMatch = statement.match(/^ALTER\s+TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD\s+COLUMN\s+"?([A-Za-z0-9_]+)"?/i);
    if (addColumnMatch) {
        return hasColumn(db, addColumnMatch[1], addColumnMatch[2]);
    }
    const createTableMatch = statement.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i);
    if (createTableMatch) {
        return tableExists(db, createTableMatch[1]);
    }
    const createIndexMatch = statement.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i);
    if (createIndexMatch) {
        return indexExists(db, createIndexMatch[1]);
    }
    const dropIndexIfExistsMatch = statement.match(/^DROP\s+INDEX\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/i);
    if (dropIndexIfExistsMatch) {
        return !indexExists(db, dropIndexIfExistsMatch[1]);
    }
    return false;
}
function isMigrationSchemaAlreadySatisfied(db, migrationSql) {
    const statements = splitSqlStatements(migrationSql);
    if (statements.length === 0) {
        return false;
    }
    return statements.every((statement) => isStatementAlreadySatisfied(db, statement));
}
function canTreatMigrationAsAlreadyApplied(db, migration, error) {
    const sqliteError = error;
    const message = sqliteError?.message ?? "";
    if (sqliteError?.code !== "SQLITE_ERROR") {
        return false;
    }
    const duplicateColumnMatch = message.match(/duplicate column name:\s*"?([A-Za-z0-9_]+)"?/i);
    if (duplicateColumnMatch) {
        const columnName = duplicateColumnMatch[1];
        const addColumnRegex = /ALTER\s+TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD\s+COLUMN\s+"?([A-Za-z0-9_]+)"?/gi;
        for (const match of migration.sql.matchAll(addColumnRegex)) {
            const tableName = match[1];
            const statementColumnName = match[2];
            if (statementColumnName === columnName && hasColumn(db, tableName, columnName)) {
                return areSchemaStatementsAlreadySatisfied(db, migration.sql);
            }
        }
        return false;
    }
    if (/table\s+["`']?[A-Za-z0-9_]+["`']?\s+already exists/i.test(message)) {
        const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i;
        const match = migration.sql.match(createTableRegex);
        if (!match) {
            return false;
        }
        return tableExists(db, match[1]) && areSchemaStatementsAlreadySatisfied(db, migration.sql);
    }
    if (/index\s+["`']?[A-Za-z0-9_]+["`']?\s+already exists/i.test(message)) {
        const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i;
        const match = migration.sql.match(createIndexRegex);
        if (!match) {
            return false;
        }
        return indexExists(db, match[1]) && areSchemaStatementsAlreadySatisfied(db, migration.sql);
    }
    return false;
}
// Nicht-Schema-Statements (UPDATE-Backfills, INSERTs, PRAGMAs) einer Migration,
// deren Schema-Statements bereits erfüllt sind (z. B. durch ein früheres `db push`).
// Sie müssen trotzdem ausgeführt werden, sonst fehlen Daten-Backfills still.
function extractDataStatements(migrationSql) {
    return splitSqlStatements(migrationSql).filter((statement) => !isSchemaStatement(statement));
}
function runDataStatementsForSatisfiedMigration(db, migrationSql) {
    const dataStatements = extractDataStatements(migrationSql);
    for (const statement of dataStatements) {
        db.exec(`${statement};`);
    }
    return dataStatements.length;
}
function needsBaselineInitialization(db) {
    return !tableExists(db, "User");
}
function applyBaselineSchema(db) {
    const baselineSql = (0, fs_1.readFileSync)(BASELINE_SQL_PATH, "utf8");
    db.exec(baselineSql);
}
function run() {
    const databaseUrl = process.env.DATABASE_URL || "file:./data/dev.db";
    const dbPath = resolveSqlitePath(databaseUrl);
    const db = new better_sqlite3_1.default(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.exec(`
    CREATE TABLE IF NOT EXISTS "_AppMigration" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
    if (needsBaselineInitialization(db)) {
        applyBaselineSchema(db);
        console.log("Baseline-Schema aus create_admin.sql initialisiert.");
    }
    const appliedStmt = db.prepare('SELECT "name", "checksum" FROM "_AppMigration" WHERE "name" = ?');
    const insertStmt = db.prepare('INSERT INTO "_AppMigration" ("name", "checksum") VALUES (?, ?)');
    const migrations = listMigrationEntries();
    for (const migration of migrations) {
        const applied = appliedStmt.get(migration.name);
        if (applied) {
            if (applied.checksum !== migration.checksum) {
                throw new Error(`Migration ${migration.name} wurde bereits mit anderem Inhalt angewendet.`);
            }
            continue;
        }
        // Fremdschlüssel während der Migration deaktivieren (Prisma-Standardmuster für
        // Tabellen-Neubauten): innerhalb einer Transaktion ist `PRAGMA foreign_keys=OFF`
        // wirkungslos, und bei aktiven FKs löst ein DROP TABLE die ON-DELETE-CASCADE-Aktionen
        // der Kind-Tabellen aus. Konsistenz wird nach der Migration per foreign_key_check geprüft.
        db.pragma("foreign_keys = OFF");
        const tx = db.transaction(() => {
            db.exec(migration.sql);
            const violations = db.prepare("PRAGMA foreign_key_check;").all();
            if (violations.length > 0) {
                throw new Error(`Migration ${migration.name} hinterlässt Fremdschlüssel-Verletzungen: ${JSON.stringify(violations)}`);
            }
            insertStmt.run(migration.name, migration.checksum);
        });
        try {
            tx();
            console.log(`Migration angewendet: ${migration.name}`);
        }
        catch (error) {
            if (!canTreatMigrationAsAlreadyApplied(db, migration, error)) {
                throw error;
            }
            // Schema-Statements sind bereits erfüllt — Daten-Backfills der Migration
            // müssen trotzdem laufen (die ursprüngliche Transaktion wurde zurückgerollt).
            const backfillTx = db.transaction(() => {
                const executed = runDataStatementsForSatisfiedMigration(db, migration.sql);
                insertStmt.run(migration.name, migration.checksum);
                return executed;
            });
            const executedCount = backfillTx();
            console.warn(`Migration als bereits angewendet markiert (Schema bereits vorhanden), ` +
                `${executedCount} Daten-Statement(s) ausgeführt: ${migration.name}`);
        }
        finally {
            db.pragma("foreign_keys = ON");
        }
    }
    db.close();
}
if (typeof require !== "undefined" && require.main === module) {
    run();
}

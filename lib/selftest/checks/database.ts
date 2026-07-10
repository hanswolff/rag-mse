import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { CheckVerdict, RegisteredCheck } from "../types";

const DB_COMPONENT = "Datenbank";
const SCHEMA_COMPONENT = "Datenbank-Schema";
const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

async function checkConnectivity(): Promise<CheckVerdict> {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok", message: "Datenbank erreichbar" };
}

function listMigrationFolders(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrationNames(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`SELECT "name" FROM "_AppMigration"`;
  return new Set(rows.map((row) => row.name));
}

async function checkMigrations(): Promise<CheckVerdict> {
  const expected = listMigrationFolders();
  if (expected.length === 0) {
    return { status: "warn", message: "Keine Migrationsverzeichnisse gefunden" };
  }

  const applied = await getAppliedMigrationNames();
  const missing = expected.filter((name) => !applied.has(name));

  if (missing.length > 0) {
    return {
      status: "error",
      message: `${missing.length} Migration(en) nicht angewendet: ${missing.join(", ")}`,
      details: { missing, appliedCount: applied.size, expectedCount: expected.length },
    };
  }

  return {
    status: "ok",
    message: `Alle ${expected.length} Migrationen angewendet`,
    details: { appliedCount: applied.size, expectedCount: expected.length },
  };
}

export const databaseChecks: RegisteredCheck[] = [
  { name: "database.connectivity", component: DB_COMPONENT, run: checkConnectivity },
  { name: "database.migrations", component: SCHEMA_COMPONENT, run: checkMigrations },
];

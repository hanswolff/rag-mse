import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { serializedSqliteAdapter } from "@/lib/serialized-sqlite-adapter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPragmasApplied: boolean | undefined;
};

const databaseUrl = process.env.DATABASE_URL || "file:./data/prod.db";
// timeout = better-sqlite3 busy_timeout in ms: Schreibkonflikte warten,
// statt sofort mit SQLITE_BUSY zu scheitern.
// Serialisiert, weil der Adapter nur eine Verbindung hat: Abfragen außerhalb
// einer Transaktion liefen sonst in deren offenes BEGIN (ADR 0012).
const adapter = serializedSqliteAdapter(
  new PrismaBetterSqlite3({ url: databaseUrl, timeout: 10_000 })
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: [
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  });

// WAL explizit setzen statt als Seiteneffekt des Migrations-Runners —
// sonst bekommt z. B. eine per `prisma db push` erzeugte Dev-DB nie WAL.
// journal_mode ist in der DB-Datei persistent; einmal pro Prozess genügt.
if (!globalForPrisma.prismaPragmasApplied) {
  globalForPrisma.prismaPragmasApplied = true;
  void prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {
    // z. B. read-only Dateisystem — der Migrations-Runner setzt WAL ohnehin
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

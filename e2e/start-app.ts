import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "../scripts/run-db-migrations";
import { seedE2eFixtures } from "./fixtures";

// Startet den Production-Build für die Playwright-Kernsuite gegen eine frische
// Wegwerf-SQLite in einem Temp-Verzeichnis. Baut bewusst NICHT selbst.

const PORT = 3900;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, "..");

const buildIdPath = path.join(repoRoot, ".next", "BUILD_ID");
if (!existsSync(buildIdPath)) {
  console.error(
    "Kein Production-Build gefunden (.next/BUILD_ID fehlt) — bitte erst pnpm build ausführen."
  );
  process.exit(1);
}

const tempDir = mkdtempSync(path.join(tmpdir(), "rag-mse-e2e-"));
const databaseUrl = `file:${path.join(tempDir, "e2e.db")}`;

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NEXTAUTH_SECRET: "e2e-nextauth-secret-mit-mindestens-32-zeichen-laenge",
  NEXTAUTH_URL: BASE_URL,
  APP_URL: BASE_URL,
  EMAIL_DEV_MODE: "true",
  COOKIE_SECURE: "false",
  TZ: "Europe/Berlin",
  // Lässt die Konfigurations-Validierung die lokale HTTP-/Dev-Konstellation
  // trotz NODE_ENV=production (next start) zu.
  DEVELOPMENT_DEPLOYMENT: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.SEED_ADMIN_EMAIL;
delete env.SEED_ADMIN_PASSWORD;
delete env.SEED_ADMIN_NAME;
delete env.ALLOW_DB_SEED;

let child: ReturnType<typeof spawn> | null = null;

function removeTempDir(): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Temp-Verzeichnis bestmöglich aufräumen; Rest übernimmt das Betriebssystem.
  }
}

// Vor dem Spawn registriert: ein Abbruch während Migration oder Seed darf das
// Temp-Verzeichnis nicht liegen lassen.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (child) {
      child.kill(signal);
      return;
    }
    removeTempDir();
    process.exit(0);
  });
}

async function main(): Promise<void> {
  process.env.TZ = "Europe/Berlin";
  console.log(`E2E-Wegwerfdatenbank: ${databaseUrl}`);
  console.log(`Getesteter Build: ${readFileSync(buildIdPath, "utf8").trim()} (${statSync(buildIdPath).mtime.toISOString()})`);

  runMigrations(databaseUrl, { quiet: true });
  await seedE2eFixtures(databaseUrl);
  console.log("E2E-Fixtures angelegt (Admin, Mitglied, Termin, Umfrage).");

  const nextBin = path.join(repoRoot, "node_modules", ".bin", "next");
  child = spawn(nextBin, ["start", "-p", String(PORT)], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`E2E-Start fehlgeschlagen: ${nextBin} konnte nicht gestartet werden:`, error);
    removeTempDir();
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    removeTempDir();
    if (signal) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("E2E-Start fehlgeschlagen:", error);
  removeTempDir();
  process.exit(1);
});

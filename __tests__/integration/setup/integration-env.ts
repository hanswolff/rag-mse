import { mkdtempSync, readdirSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { runMigrations } from "../../../scripts/run-db-migrations";

const TMP_PREFIX = "rag-mse-integration-";
const VERWAISTE_ALTERSGRENZE_MS = 60 * 60 * 1000;

// Abgebrochene Läufe (Ctrl-C, Worker-Absturz) kommen nicht mehr zum afterAll-
// Cleanup. Beim Start alte Reste wegräumen, damit /tmp nicht zuwächst.
function entferneVerwaisteTempVerzeichnisse(): void {
  const jetzt = Date.now();
  let eintraege: string[];
  try {
    eintraege = readdirSync(tmpdir());
  } catch {
    return;
  }

  for (const eintrag of eintraege) {
    if (!eintrag.startsWith(TMP_PREFIX)) continue;
    const vollerPfad = path.join(tmpdir(), eintrag);
    try {
      if (jetzt - statSync(vollerPfad).mtimeMs < VERWAISTE_ALTERSGRENZE_MS) continue;
      rmSync(vollerPfad, { recursive: true, force: true });
    } catch {
      // Fremde oder gerade laufende Verzeichnisse überspringen.
    }
  }
}

// Läuft vor dem Laden der Testdatei (setupFiles): DATABASE_URL muss gesetzt
// sein, bevor lib/prisma importiert wird — der Client liest die URL beim Import.
// Jede Testdatei bekommt ihre eigene frische SQLite in einem Temp-Verzeichnis;
// parallel laufende Testdateien können sich dadurch nicht in die Quere kommen.
process.env.TZ = "Europe/Berlin";
// Der Erinnerungs-Worker rechnet mit APP_TIMEZONE, die Testhelfer mit der
// Prozess-TZ: beide müssen übereinstimmen, sonst verfehlen die Läufe ihr Fenster.
process.env.APP_TIMEZONE = "Europe/Berlin";
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "integration-test-secret-with-32-plus-chars";
process.env.APP_URL = process.env.APP_URL || "http://localhost:3000";

entferneVerwaisteTempVerzeichnisse();

const tempDir = mkdtempSync(path.join(tmpdir(), TMP_PREFIX));
process.env.RAG_MSE_INTEGRATION_TMP_DIR = tempDir;
process.env.DATABASE_URL = `file:${path.join(tempDir, "test.db")}`;

runMigrations(process.env.DATABASE_URL, { quiet: true });

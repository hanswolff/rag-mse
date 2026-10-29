import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// Der Pre-Switch-Smoke in deploy.sh (run_pre_switch_http_smoke) startet das
// frisch gebaute Image mit einer von Hand gespiegelten Kopie der
// environment-Liste aus compose.yaml. Diese Spiegelung ist eine Drift-Quelle:
// Eine in compose.yaml ergänzte Variable, die im Smoke fehlt, lässt die
// Konfig-Validierung im Smoke anders laufen als in Produktion — der Smoke
// prüft dann ein anderes Setup als das, was gleich live geht. Dieser Test
// vergleicht die Variablen-NAMEN beider Listen (Werte dürfen abweichen, z. B.
// die Wegwerf-DB des Smoke) und schlägt bei Drift mit erklärender Meldung fehl.

describe("Deploy smoke / compose env parity", () => {
  const deployShPath = join(__dirname, "../deploy.sh");
  const composePath = join(__dirname, "../compose.yaml");

  // Bewusst erlaubte Abweichungen — jede Ausnahme braucht eine Begründung:
  //
  // Nur in compose.yaml, absichtlich NICHT im Smoke-Container gesetzt:
  // Der Smoke läuft mit leerer Wegwerf-Datenbank und darf niemals seeden
  // (Kommentar am podman run in deploy.sh: "bewusst weggelassene
  // Seed-Variablen").
  const COMPOSE_ONLY_ALLOWED = new Set([
    "ALLOW_DB_SEED",
    "SEED_ADMIN_EMAIL",
    "SEED_ADMIN_PASSWORD",
    "SEED_ADMIN_NAME",
  ]);

  // Nur im Smoke gesetzte Variablen: aktuell keine. DATABASE_URL gehört NICHT
  // hierher — der Name steht in beiden Listen, nur der Wert weicht im Smoke ab
  // (file:/app/data/smoke.db statt der Produktions-DB).
  const SMOKE_ONLY_ALLOWED = new Set<string>([]);

  function extractSmokeEnvNames(): string[] {
    const deploySh = readFileSync(deployShPath, "utf-8");
    // Nur innerhalb der Smoke-Funktion suchen, damit ein künftiger zweiter
    // `podman run` an anderer Stelle die Liste nicht verfälscht.
    const fnMatch = deploySh.match(/^run_pre_switch_http_smoke\(\) \{\n[\s\S]*?\n\}/m);
    expect(fnMatch).not.toBeNull();

    const names: string[] = [];
    for (const match of fnMatch![0].matchAll(/^\s*-e\s+([A-Za-z_][A-Za-z0-9_]*)=/gm)) {
      names.push(match[1]);
    }
    return names;
  }

  function extractComposeEnvNames(): string[] {
    const compose = readFileSync(composePath, "utf-8");
    const lines = compose.split("\n");
    const startIndex = lines.findIndex((line) => line.trim() === "environment:");
    expect(startIndex).toBeGreaterThan(-1);

    const names: string[] = [];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*#/.test(line)) continue; // Kommentare innerhalb der Liste
      const entry = line.match(/^\s+-\s+([A-Za-z_][A-Za-z0-9_]*)=/);
      if (!entry) break; // Ende des environment:-Blocks (z. B. volumes:)
      names.push(entry[1]);
    }
    return names;
  }

  it("parses both env lists (guard against silent parser drift)", () => {
    // Schrumpft eine der Listen unerwartet stark, ist eher der Parser kaputt
    // als die Konfiguration — dann soll der Test das sagen statt grün zu lügen.
    expect(extractSmokeEnvNames().length).toBeGreaterThanOrEqual(20);
    expect(extractComposeEnvNames().length).toBeGreaterThanOrEqual(20);
  });

  it("mirrors every compose environment variable in the pre-switch smoke run", () => {
    const smokeNames = new Set(extractSmokeEnvNames());
    const missingInSmoke = extractComposeEnvNames().filter(
      (name) => !smokeNames.has(name) && !COMPOSE_ONLY_ALLOWED.has(name)
    );

    if (missingInSmoke.length > 0) {
      throw new Error(
        `compose.yaml definiert Variablen, die der Pre-Switch-Smoke in deploy.sh nicht spiegelt: ` +
          `${missingInSmoke.join(", ")}. ` +
          `Entweder die -e-Liste in run_pre_switch_http_smoke (deploy.sh) ergänzen ` +
          `oder die Abweichung mit Begründung in COMPOSE_ONLY_ALLOWED aufnehmen.`
      );
    }
  });

  it("does not set smoke variables that compose does not know", () => {
    const composeNames = new Set(extractComposeEnvNames());
    const extraInSmoke = extractSmokeEnvNames().filter(
      (name) => !composeNames.has(name) && !SMOKE_ONLY_ALLOWED.has(name)
    );

    if (extraInSmoke.length > 0) {
      throw new Error(
        `Der Pre-Switch-Smoke in deploy.sh setzt Variablen, die compose.yaml nicht kennt: ` +
          `${extraInSmoke.join(", ")}. ` +
          `Entweder die environment-Liste in compose.yaml ergänzen ` +
          `oder die Abweichung mit Begründung in SMOKE_ONLY_ALLOWED aufnehmen.`
      );
    }
  });

  it("keeps the exception lists free of stale entries", () => {
    const composeNames = new Set(extractComposeEnvNames());
    const smokeNames = new Set(extractSmokeEnvNames());

    for (const name of COMPOSE_ONLY_ALLOWED) {
      // Verschwindet die Variable aus compose.yaml oder taucht sie im Smoke
      // auf, ist die Ausnahme veraltet und muss gepflegt werden.
      expect(composeNames.has(name)).toBe(true);
      expect(smokeNames.has(name)).toBe(false);
    }
    for (const name of SMOKE_ONLY_ALLOWED) {
      expect(smokeNames.has(name)).toBe(true);
      expect(composeNames.has(name)).toBe(false);
    }
  });
});

// Zweite Drift-Quelle: Variablen, die der App-Code liest, aber compose.yaml nicht
// an den Container durchreicht. Solche Variablen wirkten bisher nur zufällig über
// die ins Image gebackene .env. Der Test sammelt alle im Laufzeitcode gelesenen
// Namen (process.env.X, process.env["X"] und die Env-Helfer aus lib/env.ts bzw.
// lib/config-validation.ts) und verlangt sie in der environment-Liste.
describe("App env reads / compose parity", () => {
  const projectRoot = join(__dirname, "..");
  const SOURCE_DIRS = ["lib", "app", "components", "prisma"];
  const SOURCE_FILES = [
    "proxy.ts",
    "instrumentation.ts",
    "instrumentation.node.ts",
    "scripts/validate-config.ts",
    "scripts/run-db-migrations.ts",
    "entrypoint.sh",
  ];

  // Bewusst nicht in compose.yaml — jede Ausnahme braucht eine Begründung:
  const NOT_IN_COMPOSE_ALLOWED = new Map<string, string>([
    ["NEXT_RUNTIME", "setzt Next.js selbst"],
    ["NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_* wird beim Host-Build eingebacken, Laufzeitwert wirkungslos"],
    ["NEXT_PUBLIC_APP_TAGLINE", "NEXT_PUBLIC_* wird beim Host-Build eingebacken, Laufzeitwert wirkungslos"],
    ["NEXT_PUBLIC_APP_DESCRIPTION", "NEXT_PUBLIC_* wird beim Host-Build eingebacken, Laufzeitwert wirkungslos"],
    ["APP_UID", "Build-Arg und user/userns-Mapping in compose.yaml, keine Container-Env"],
    ["APP_GID", "Build-Arg und user/userns-Mapping in compose.yaml, keine Container-Env"],
  ]);

  // In compose.yaml, ohne dass Anwendungscode sie liest:
  const COMPOSE_ONLY_READERS = new Map<string, string>([
    ["TZ", "wirkt über die C-Library/Node auf die lokale Zeit"],
  ]);

  const ENV_HELPERS = [
    "envInt",
    "envNonNegativeInt",
    "envBool",
    "parseUploadLimitMb",
    "requireEnv",
    "requireValidUrl",
    "validateBooleanEnvVar",
    "validatePositiveIntegerEnvVar",
  ];

  function collectFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        return entry === "migrations" ? [] : collectFiles(fullPath);
      }
      return /\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry) ? [fullPath] : [];
    });
  }

  function extractCodeEnvReads(): Map<string, string> {
    const files = [
      ...SOURCE_DIRS.flatMap((dir) => collectFiles(join(projectRoot, dir))),
      ...SOURCE_FILES.map((file) => join(projectRoot, file)),
    ];
    const patterns = [
      /process\.env\??\.([A-Z][A-Z0-9_]*)/g,
      /process\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g,
      new RegExp(`\\b(?:${ENV_HELPERS.join("|")})\\(\\s*["']([A-Z][A-Z0-9_]*)["']`, "g"),
      /directoryEnvVar:\s*["']([A-Z][A-Z0-9_]*)["']/g,
      /\$\{([A-Z][A-Z0-9_]*)(?::-[^}]*)?\}/g,
    ];

    const reads = new Map<string, string>();
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const isShell = file.endsWith(".sh");
      for (const pattern of isShell ? patterns.slice(-1) : patterns.slice(0, -1)) {
        for (const match of content.matchAll(pattern)) {
          if (!reads.has(match[1])) {
            reads.set(match[1], relative(projectRoot, file));
          }
        }
      }
    }
    return reads;
  }

  function composeEnvNames(): Set<string> {
    const compose = readFileSync(join(projectRoot, "compose.yaml"), "utf-8");
    const block = compose.slice(compose.indexOf("    environment:"), compose.indexOf("    volumes:"));
    return new Set([...block.matchAll(/^\s+-\s+([A-Za-z_][A-Za-z0-9_]*)=/gm)].map((match) => match[1]));
  }

  it("finds the env reads of the known readers (guard against silent parser drift)", () => {
    const reads = extractCodeEnvReads();
    for (const name of [
      "DATABASE_URL",
      "EMAIL_OUTBOX_POLL_INTERVAL_MS",
      "EMAIL_OUTBOX_BATCH_SIZE",
      "SMTP_CONNECTION_TIMEOUT_MS",
      "DOCUMENT_UPLOAD_MAX_MB",
      "AUSSCHREIBUNGEN_DIR",
      "ADMIN_EMAILS",
    ]) {
      expect(reads.has(name)).toBe(true);
    }
  });

  it("passes every env variable the app reads through compose.yaml", () => {
    const composeNames = composeEnvNames();
    const missing = [...extractCodeEnvReads()]
      .filter(([name]) => !composeNames.has(name) && !NOT_IN_COMPOSE_ALLOWED.has(name))
      .map(([name, file]) => `${name} (${file})`);

    if (missing.length > 0) {
      throw new Error(
        `Der App-Code liest Variablen, die compose.yaml nicht an den Container übergibt: ` +
          `${missing.join(", ")}. ` +
          `In compose.yaml (mit Code-Default) und im Smoke-Run von deploy.sh ergänzen ` +
          `oder mit Begründung in NOT_IN_COMPOSE_ALLOWED aufnehmen.`
      );
    }
  });

  it("does not pass compose variables that nothing reads", () => {
    const reads = extractCodeEnvReads();
    const unread = [...composeEnvNames()].filter(
      (name) => !reads.has(name) && !COMPOSE_ONLY_READERS.has(name)
    );
    expect(unread).toEqual([]);
  });

  it("keeps the exception lists free of stale entries", () => {
    const reads = extractCodeEnvReads();
    const composeNames = composeEnvNames();
    for (const name of NOT_IN_COMPOSE_ALLOWED.keys()) {
      expect(reads.has(name)).toBe(true);
      expect(composeNames.has(name)).toBe(false);
    }
    for (const name of COMPOSE_ONLY_READERS.keys()) {
      expect(composeNames.has(name)).toBe(true);
    }
  });
});

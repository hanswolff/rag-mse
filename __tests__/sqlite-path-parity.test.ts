import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path, { join } from "path";
import { resolveSqlitePath } from "../scripts/run-db-migrations";

// Die Auflösung DATABASE_URL (file:-URL) -> Dateipfad existiert bewusst
// mehrfach mit unterschiedlicher Semantik:
//
//   - deploy.sh `resolve_host_sqlite_path`: HOST-Sicht. Container-Pfade unter
//     /app/ und relative Pfade werden auf das Projektverzeichnis abgebildet;
//     Nicht-file:-URLs und leere Pfade schlagen fehl (Exit-Code 1).
//   - entrypoint.sh (case-Block): CONTAINER-Sicht. Relative Pfade landen unter
//     /app/, unbekannte URLs fallen auf /app/data/prod.db zurück — der
//     Entrypoint kennt keinen Fehlerpfad.
//   - scripts/run-db-migrations.ts `resolveSqlitePath`: löst relative Pfade
//     gegen das Arbeitsverzeichnis auf (läuft im Container mit cwd=/app, in
//     Tests mit Repo-cwd); Nicht-file:-URLs werfen.
//   - prisma.config.ts: nur ein Default-Wert, keine Auflösung.
//
// Ziel dieses Tests ist NICHT identisches Verhalten, sondern Drift-Erkennung:
// Die Fixture-Tabelle dokumentiert je Implementierung das erwartete Ergebnis.
// Wer eine der Implementierungen ändert, sieht hier sofort, ob die anderen
// Semantiken noch zusammenpassen (z. B. dass alle Defaults dieselbe
// Container-Datei /app/data/prod.db meinen).

const projectRoot = join(__dirname, "..");
const deployShPath = join(projectRoot, "deploy.sh");
const entrypointPath = join(projectRoot, "entrypoint.sh");
const prismaConfigPath = join(projectRoot, "prisma.config.ts");

// Fester Host-Projektpfad für die deploy.sh-Erwartungen, unabhängig davon,
// wo dieses Repo tatsächlich liegt.
const HOST_PROJECT_DIR = "/host/project";

type BashResult = { ok: true; path: string } | { ok: false };
type TsResult = { ok: true; path: string } | { ok: false };

interface Fixture {
  databaseUrl: string;
  /** deploy.sh resolve_host_sqlite_path (Host-Pfad oder Fehler) */
  deploy: BashResult;
  /** entrypoint.sh case-Block (immer ein Container-Pfad, nie Fehler) */
  entrypoint: string;
  /** scripts/run-db-migrations.ts resolveSqlitePath (cwd-relativ oder throw) */
  migrations: TsResult;
}

const cwd = process.cwd();

const fixtures: Fixture[] = [
  {
    databaseUrl: "file:./data/prod.db",
    deploy: { ok: true, path: `${HOST_PROJECT_DIR}/data/prod.db` },
    entrypoint: "/app/data/prod.db",
    migrations: { ok: true, path: path.resolve(cwd, "data/prod.db") },
  },
  {
    // Container-Pfad: deploy.sh mappt ihn auf den Host, entrypoint.sh und die
    // Migrations (cwd=/app im Container) benutzen ihn unverändert.
    databaseUrl: "file:/app/data/prod.db",
    deploy: { ok: true, path: `${HOST_PROJECT_DIR}/data/prod.db` },
    entrypoint: "/app/data/prod.db",
    migrations: { ok: true, path: "/app/data/prod.db" },
  },
  {
    // Relativ ohne "./" — alle Implementierungen behandeln es wie "./".
    databaseUrl: "file:data/prod.db",
    deploy: { ok: true, path: `${HOST_PROJECT_DIR}/data/prod.db` },
    entrypoint: "/app/data/prod.db",
    migrations: { ok: true, path: path.resolve(cwd, "data/prod.db") },
  },
  {
    // Absoluter Pfad außerhalb von /app bleibt überall unverändert.
    databaseUrl: "file:/var/lib/rag-mse/prod.db",
    deploy: { ok: true, path: "/var/lib/rag-mse/prod.db" },
    entrypoint: "/var/lib/rag-mse/prod.db",
    migrations: { ok: true, path: "/var/lib/rag-mse/prod.db" },
  },
  {
    // Leer/nicht gesetzt: deploy.sh und Migrations schlagen fehl (dort greift
    // jeweils ein eigener Default VOR dem Aufruf), der Entrypoint-Default
    // file:./data/prod.db löst auf die Container-Produktions-DB auf.
    databaseUrl: "",
    deploy: { ok: false },
    entrypoint: "/app/data/prod.db",
    migrations: { ok: false },
  },
  {
    // Keine file:-URL: deploy.sh und Migrations lehnen ab, der Entrypoint
    // fällt bewusst auf die Container-Produktions-DB zurück.
    databaseUrl: "postgres://db.example/rag",
    deploy: { ok: false },
    entrypoint: "/app/data/prod.db",
    migrations: { ok: false },
  },
  {
    // Degenerierte URL ohne Pfad — dokumentiert das Ist-Verhalten:
    // deploy.sh lehnt ab, entrypoint.sh produziert "/app/" (Verzeichnis!),
    // die Migrations lösen auf das Arbeitsverzeichnis selbst auf.
    databaseUrl: "file:",
    deploy: { ok: false },
    entrypoint: "/app/",
    migrations: { ok: true, path: cwd },
  },
];

// deploy.sh: die Funktion als Text extrahieren und isoliert mit festem
// PROJECT_DIR ausführen — so testet der Test exakt den Code, der deployt.
function runDeployResolver(databaseUrl: string): BashResult {
  const deploySh = readFileSync(deployShPath, "utf-8");
  const fnMatch = deploySh.match(/^resolve_host_sqlite_path\(\) \{\n[\s\S]*?\n\}/m);
  expect(fnMatch).not.toBeNull();

  const script = [
    `PROJECT_DIR="${HOST_PROJECT_DIR}"`,
    fnMatch![0],
    'resolve_host_sqlite_path "$1"',
  ].join("\n");

  const result = spawnSync("bash", ["-c", script, "bash", databaseUrl], {
    encoding: "utf-8",
  });
  expect(result.error).toBeUndefined();

  if (result.status !== 0) {
    return { ok: false };
  }
  return { ok: true, path: result.stdout.trim() };
}

// entrypoint.sh: DB_URL-Default-Zeile plus case-Block extrahieren und mit sh
// ausführen (der Entrypoint ist ein POSIX-sh-Skript).
function runEntrypointResolver(databaseUrl: string): string {
  const entrypoint = readFileSync(entrypointPath, "utf-8");
  const blockMatch = entrypoint.match(/^DB_URL="\$\{DATABASE_URL[^\n]*\n[\s\S]*?^esac/m);
  expect(blockMatch).not.toBeNull();

  const script = `${blockMatch![0]}\nprintf '%s\\n' "$DB_FILE"`;
  const result = spawnSync("sh", ["-c", script], {
    encoding: "utf-8",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  return result.stdout.trim();
}

describe("SQLite path resolution parity (deploy.sh / entrypoint.sh / run-db-migrations)", () => {
  it.each(fixtures)("deploy.sh resolve_host_sqlite_path: '$databaseUrl'", (fixture) => {
    const actual = runDeployResolver(fixture.databaseUrl);
    expect(actual).toEqual(fixture.deploy);
  });

  it.each(fixtures)("entrypoint.sh case block: '$databaseUrl'", (fixture) => {
    expect(runEntrypointResolver(fixture.databaseUrl)).toBe(fixture.entrypoint);
  });

  it.each(fixtures)("run-db-migrations resolveSqlitePath: '$databaseUrl'", (fixture) => {
    if (fixture.migrations.ok) {
      expect(resolveSqlitePath(fixture.databaseUrl)).toBe(fixture.migrations.path);
    } else {
      expect(() => resolveSqlitePath(fixture.databaseUrl)).toThrow(
        /Nur SQLite file:-URLs/
      );
    }
  });

  it("prisma.config.ts default points at the same container database as the entrypoint default", () => {
    // prisma.config.ts löst nichts auf, sondern liefert nur einen Default.
    // Er muss dieselbe Datei meinen wie der Entrypoint-Default
    // (file:./data/prod.db -> /app/data/prod.db, siehe Fixture "leer").
    const prismaConfig = readFileSync(prismaConfigPath, "utf-8");
    expect(prismaConfig).toContain(
      'process.env.DATABASE_URL || "file:/app/data/prod.db"'
    );
  });

  it("compose.yaml, deploy.sh and the runtime clients fall back to the production database", () => {
    // Ohne Default übergäbe compose.yaml eine leere DATABASE_URL; mit `??` statt
    // `||` öffnete der Prisma-Adapter dann eine leere Temp-DB, der Healthcheck
    // (SELECT 1) würde trotzdem grün und deploy.sh übersprang das Backup.
    const compose = readFileSync(join(projectRoot, "compose.yaml"), "utf-8");
    expect(compose).toContain("- DATABASE_URL=${DATABASE_URL:-file:/app/data/prod.db}");

    const deploySh = readFileSync(deployShPath, "utf-8");
    expect(deploySh).toContain('DATABASE_URL="${DATABASE_URL:-file:/app/data/prod.db}"');
    expect(deploySh).not.toContain('-z "${DATABASE_URL:-}"');

    for (const file of ["lib/prisma.ts", "prisma/seed.ts"]) {
      const source = readFileSync(join(projectRoot, file), "utf-8");
      expect(source).toContain('process.env.DATABASE_URL || "file:./data/prod.db"');
      expect(source).not.toMatch(/process\.env\.DATABASE_URL \?\?/);
    }
  });
});

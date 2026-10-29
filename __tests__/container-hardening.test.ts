import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("Container hardening", () => {
  const containerfilePath = join(__dirname, "../Containerfile");
  const containerignorePath = join(__dirname, "../.containerignore");

  it("has Containerfile and .containerignore", () => {
    expect(existsSync(containerfilePath)).toBe(true);
    expect(existsSync(containerignorePath)).toBe(true);
  });

  it("runs in German timezone and ships the baseline schema", () => {
    const containerfile = readFileSync(containerfilePath, "utf-8");
    const compose = readFileSync(join(__dirname, "../compose.yaml"), "utf-8");

    // Termin-Datumslogik rechnet mit lokaler Zeit; UTC-Container verschiebt
    // späte Termine auf den Folgetag (Erinnerungen, Vergangenheits-Grenze).
    expect(containerfile).toContain('ENV TZ="Europe/Berlin"');
    expect(compose).toContain("TZ=${TZ:-Europe/Berlin}");
    // Baseline-Schema muss im Image liegen, sonst crasht der Erststart
    // mit leerer Datenbank (ENOENT in run-db-migrations). Es reist im
    // prisma/-Verzeichnis mit (prisma/baseline.sql).
    expect(containerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} prisma ./prisma");
    expect(existsSync(join(__dirname, "../prisma/baseline.sql"))).toBe(true);
    expect(containerfile).toContain('ENV DATABASE_URL="file:/app/data/prod.db"');
  });

  it("builds a runtime image only from host-generated artifacts", () => {
    const containerfile = readFileSync(containerfilePath, "utf-8");

    expect(containerfile).toContain("FROM node:22-slim AS runner");
    expect(containerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} .next/standalone ./");
    expect(containerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} .next/static ./.next/static");
    expect(containerfile).not.toContain("pnpm install --frozen-lockfile");
    expect(containerfile).not.toContain("pnpm run build");
    expect(containerfile).not.toContain("pnpm run build:scripts");
  });

  it("ships the healthcheck binary the compose healthcheck invokes", () => {
    const containerfile = readFileSync(containerfilePath, "utf-8");
    const compose = readFileSync(join(__dirname, "../compose.yaml"), "utf-8");

    // node:22-slim bringt kein wget mit; ohne Installation wäre der
    // Healthcheck dauerhaft unhealthy und der Deploy würde zurückrollen.
    expect(compose).toContain('"wget"');
    expect(containerfile).toContain("install -y --no-install-recommends wget");
  });

  it("keeps prod data, secrets and git history out of the standalone build", () => {
    // .next/standalone wird 1:1 ins Image kopiert; das File-Tracing nahm
    // wegen dynamischer process.cwd()-Pfade den ganzen Projektbaum auf.
    const nextConfig = readFileSync(join(__dirname, "../next.config.mjs"), "utf-8");
    const excludesBlock = nextConfig.match(/outputFileTracingExcludes:\s*\{\s*'\*':\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const pattern of ["data/**", "backups/**", ".git/**", ".env*", "coverage/**", ".scratch/**"]) {
      expect(excludesBlock).toContain(`'${pattern}'`);
    }

    const fileStorage = readFileSync(join(__dirname, "../lib/file-storage.ts"), "utf-8");
    expect(fileStorage).toContain("path.join(/* turbopackIgnore: true */ process.cwd(), config.defaultSubdir)");

    // Next kopiert .env unabhängig vom Tracing; deploy.sh entfernt sie und
    // bricht ab, falls trotzdem etwas Sensibles im Standalone liegt.
    const deploy = readFileSync(join(__dirname, "../deploy.sh"), "utf-8");
    expect(deploy).toContain('rm -f "$PROJECT_DIR/.next/standalone/.env"');
    expect(deploy).toContain("Running quality gate: standalone contents...");
    expect(deploy).toMatch(/-name data -o -name backups -o -name '\.env\*' -o -name \.git/);
    const gateIndex = deploy.indexOf("Running quality gate: standalone contents...");
    expect(gateIndex).toBeGreaterThan(deploy.indexOf("pnpm run build\n"));
    expect(gateIndex).toBeLessThan(deploy.indexOf("podman-compose build app"));

    const containerignore = readFileSync(containerignorePath, "utf-8");
    const reinclude = containerignore.indexOf("!.next/standalone/**");
    for (const pattern of [".next/standalone/.env", ".next/standalone/.git", ".next/standalone/data", ".next/standalone/backups"]) {
      expect(containerignore.indexOf(`${pattern}\n`)).toBeGreaterThan(reinclude);
    }
  });

  it("excludes sensitive paths while allowing required host build artifacts", () => {
    const containerignore = readFileSync(containerignorePath, "utf-8");

    expect(containerignore).toContain(".git");
    expect(containerignore).toContain(".env");
    expect(containerignore).toContain(".env.*");
    expect(containerignore).toContain("node_modules");
    expect(containerignore).toContain("__tests__");
    expect(containerignore).toContain("__mocks__");
    expect(containerignore).toContain("docs");
    expect(containerignore).toContain("ops");
    expect(containerignore).toContain("data");
    expect(containerignore).toContain(".next");
    expect(containerignore).toContain("!.next/standalone");
    expect(containerignore).toContain("!.next/static");
  });
});

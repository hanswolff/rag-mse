import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

const CHECKER = path.join(__dirname, "../scripts/check-script-deps.mjs");

function runChecker(scriptsDist: string, standalone: string) {
  return spawnSync(process.execPath, [CHECKER, scriptsDist, standalone], {
    encoding: "utf8",
  });
}

function createFixture(options: { requires: string[]; bundled: string[] }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "script-deps-"));
  const scriptsDist = path.join(root, "scripts-dist");
  const bundleModules = path.join(root, "standalone", "node_modules");

  mkdirSync(scriptsDist, { recursive: true });
  mkdirSync(bundleModules, { recursive: true });

  writeFileSync(
    path.join(scriptsDist, "entry.js"),
    options.requires.map((name) => `require("${name}");`).join("\n")
  );

  for (const name of options.bundled) {
    mkdirSync(path.join(bundleModules, name), { recursive: true });
  }

  return { root, scriptsDist, standalone: path.join(root, "standalone") };
}

describe("check-script-deps", () => {
  const fixtures: string[] = [];

  afterAll(() => {
    for (const root of fixtures) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(options: { requires: string[]; bundled: string[] }) {
    const created = createFixture(options);
    fixtures.push(created.root);
    return created;
  }

  it("passes when every external package is bundled", () => {
    const { scriptsDist, standalone } = fixture({
      requires: ["zod", "node:fs", "./local-module"],
      bundled: ["zod"],
    });

    const result = runChecker(scriptsDist, standalone);

    expect(result.status).toBe(0);
  });

  it("fails and names the package when a script-only dependency is missing", () => {
    const { scriptsDist, standalone } = fixture({
      requires: ["bcryptjs"],
      bundled: [],
    });

    const result = runChecker(scriptsDist, standalone);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bcryptjs");
    expect(result.stderr).toContain("entry.js");
  });

  it("resolves scoped packages by package name, not by subpath", () => {
    const { scriptsDist, standalone } = fixture({
      requires: ["@prisma/adapter-better-sqlite3", "dotenv/config"],
      bundled: ["@prisma/adapter-better-sqlite3", "dotenv"],
    });

    const result = runChecker(scriptsDist, standalone);

    expect(result.status).toBe(0);
  });

  // Ohne diese Abgrenzung liefe die Auflösung auf dem Host bis in die
  // Repo-node_modules hoch und hielte fehlende Pakete für vorhanden.
  it("does not treat packages outside the bundle as available", () => {
    const { scriptsDist, standalone } = fixture({
      requires: ["react"],
      bundled: [],
    });

    const result = runChecker(scriptsDist, standalone);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("react");
  });

  it("ignores Node built-ins", () => {
    const { scriptsDist, standalone } = fixture({
      requires: ["fs", "node:path", "crypto"],
      bundled: [],
    });

    const result = runChecker(scriptsDist, standalone);

    expect(result.status).toBe(0);
  });
});

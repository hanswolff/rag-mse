import { spawnSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

const BUNDLER = path.join(__dirname, "../scripts/bundle-script-deps.mjs");

type PackageSpec = {
  /** Ablageort relativ zur Auflösungswurzel, z.B. "node_modules/htmlparser2". */
  at: string;
  version: string;
  dependencies?: Record<string, string>;
};

function runBundler(root: string) {
  return spawnSync(
    process.execPath,
    [
      BUNDLER,
      path.join(root, "scripts-dist"),
      path.join(root, "standalone"),
      path.join(root, "resolve-root"),
    ],
    { encoding: "utf8" }
  );
}

function createFixture(options: {
  requires: string[];
  packages: PackageSpec[];
  bundled?: PackageSpec[];
}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "bundle-deps-"));
  const scriptsDist = path.join(root, "scripts-dist");
  const bundleModules = path.join(root, "standalone", "node_modules");
  const resolveRoot = path.join(root, "resolve-root");

  mkdirSync(scriptsDist, { recursive: true });
  mkdirSync(bundleModules, { recursive: true });
  mkdirSync(resolveRoot, { recursive: true });

  writeFileSync(
    path.join(scriptsDist, "entry.js"),
    options.requires.map((name) => `require("${name}");`).join("\n")
  );

  const write = (base: string, spec: PackageSpec) => {
    const dir = path.join(base, spec.at);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: path.basename(spec.at),
        version: spec.version,
        dependencies: spec.dependencies || {},
      })
    );
  };

  for (const spec of options.packages) write(resolveRoot, spec);
  for (const spec of options.bundled || []) write(path.join(root, "standalone"), spec);

  return { root, bundleModules };
}

describe("bundle-script-deps", () => {
  const fixtures: string[] = [];

  afterAll(() => {
    for (const root of fixtures) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(options: Parameters<typeof createFixture>[0]) {
    const created = createFixture(options);
    fixtures.push(created.root);
    return created;
  }

  it("copies a script-only package and its transitive dependencies", () => {
    const { root, bundleModules } = fixture({
      requires: ["sanitize-html"],
      packages: [
        { at: "node_modules/sanitize-html", version: "2.17.5", dependencies: { entities: "^7.0.0" } },
        { at: "node_modules/entities", version: "7.0.1" },
      ],
    });

    const result = runBundler(root);

    expect(result.status).toBe(0);
    expect(existsSync(path.join(bundleModules, "sanitize-html"))).toBe(true);
    expect(existsSync(path.join(bundleModules, "entities"))).toBe(true);
  });

  // Das Bundle hat ein flaches node_modules und kann nur eine Fassung je Paket
  // halten. Ohne Meldung sucht niemand hier, wenn ein Container-Skript anders
  // läuft als auf dem Host.
  it("warns when two dependants resolve the same package to different versions", () => {
    const { root } = fixture({
      requires: ["htmlparser2", "dom-serializer"],
      packages: [
        {
          at: "node_modules/htmlparser2",
          version: "10.0.0",
          dependencies: { entities: "^7.0.0" },
        },
        { at: "node_modules/entities", version: "7.0.1" },
        {
          at: "node_modules/dom-serializer",
          version: "2.0.0",
          dependencies: { entities: "^4.2.0" },
        },
        { at: "node_modules/dom-serializer/node_modules/entities", version: "4.5.0" },
      ],
    });

    const result = runBundler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Versionskonflikt");
    expect(result.stderr).toContain("entities");
    expect(result.stderr).toContain("7.0.1");
    expect(result.stderr).toContain("4.5.0");
  });

  // Next legt beim Tracing bereits Pakete ab. Die werden nicht überschrieben —
  // die Server-Routen laufen dagegen —, aber die Abweichung muss sichtbar sein.
  it("warns when the version Next already traced differs from the one the scripts resolve", () => {
    const { root } = fixture({
      requires: ["zod"],
      packages: [{ at: "node_modules/zod", version: "4.4.3" }],
      bundled: [{ at: "node_modules/zod", version: "3.23.8" }],
    });

    const result = runBundler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Versionskonflikt");
    expect(result.stderr).toContain("3.23.8");
    expect(result.stderr).toContain("4.4.3");
  });

  it("stays quiet when every package resolves to a single version", () => {
    const { root } = fixture({
      requires: ["htmlparser2"],
      packages: [
        { at: "node_modules/htmlparser2", version: "10.0.0", dependencies: { entities: "^7.0.0" } },
        { at: "node_modules/entities", version: "7.0.1" },
      ],
      bundled: [{ at: "node_modules/entities", version: "7.0.1" }],
    });

    const result = runBundler(root);

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("Versionskonflikt");
  });
});

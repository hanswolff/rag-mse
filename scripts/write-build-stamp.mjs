#!/usr/bin/env node

// Schreibt nach `pnpm run build:scripts` einen Build-Stamp nach scripts-dist/.
// Hintergrund: scripts-dist/ wird auf dem Host gebaut und per COPY ins Image
// übernommen. Wer das Image an deploy.sh vorbei baut (z. B. manuelles
// `podman-compose build`), kann veraltete Skripte einfrieren. Der Entrypoint
// prüft die Existenz des Stamps und warnt, wenn er fehlt; die Checksumme über
// die Quelldateien macht Drift zusätzlich diagnostizierbar (Vergleich mit einem
// frisch berechneten Stand).

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "scripts-dist");
const stampPath = path.join(distDir, ".build-stamp.json");

// Quellliste = "include" aus tsconfig.build.json, damit Stamp und Build nie
// über verschiedene Dateilisten reden.
const tsconfig = JSON.parse(
  readFileSync(path.join(projectRoot, "tsconfig.build.json"), "utf8")
);

function expandPattern(pattern) {
  // tsconfig.build.json nutzt nur explizite Dateien und ein "**/*.d.ts"-Muster;
  // mehr Glob-Syntax wird hier bewusst nicht unterstützt.
  if (!pattern.includes("*")) {
    return [pattern];
  }

  const starIndex = pattern.indexOf("*");
  const baseDir = pattern.slice(0, starIndex).replace(/\/$/, "");
  const suffix = pattern.slice(pattern.lastIndexOf("*") + 1); // z. B. ".d.ts"
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(path.join(projectRoot, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(relPath);
      } else if (entry.name.endsWith(suffix)) {
        results.push(relPath);
      }
    }
  }

  walk(baseDir);
  return results;
}

const sources = [...new Set((tsconfig.include ?? []).flatMap(expandPattern))]
  .filter((relPath) => {
    try {
      return statSync(path.join(projectRoot, relPath)).isFile();
    } catch {
      return false;
    }
  })
  .sort();

const hash = createHash("sha256");
for (const relPath of sources) {
  hash.update(relPath);
  hash.update("\0");
  hash.update(readFileSync(path.join(projectRoot, relPath)));
}

const stamp = {
  createdAt: new Date().toISOString(),
  sourcesHash: `sha256:${hash.digest("hex")}`,
  sources,
};

writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
console.log(`Build-Stamp geschrieben: ${stampPath} (${sources.length} Quelldateien)`);

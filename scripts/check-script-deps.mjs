#!/usr/bin/env node

// Die Container-Skripte laufen aus /app/scripts-dist und lösen ihre Pakete über
// /app/node_modules auf — also über das, was Next beim Standalone-Tracing
// eingesammelt hat. Fehlt dort eines, endet der Containerstart in einer
// Crash-Loop. Gegenstück: scripts/bundle-script-deps.mjs.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { collectExternalRequires, packageNameOf } from "./lib/script-deps.mjs";

const SCRIPTS_DIST = path.resolve(process.argv[2] || "scripts-dist");
const STANDALONE = path.resolve(process.argv[3] || ".next/standalone");

function main() {
  if (!existsSync(SCRIPTS_DIST) || !statSync(SCRIPTS_DIST).isDirectory()) {
    console.error(`Skript-Verzeichnis fehlt: ${SCRIPTS_DIST} (zuerst 'pnpm run build:scripts')`);
    process.exit(1);
  }
  if (!existsSync(STANDALONE)) {
    console.error(`Standalone-Bundle fehlt: ${STANDALONE} (zuerst 'pnpm run build')`);
    process.exit(1);
  }

  // Ausschließlich gegen <standalone>/node_modules prüfen: require.resolve()
  // liefe auf dem Host bis in die Repo-node_modules hoch und hielte jedes
  // fehlende Paket für vorhanden. Über /app gibt es im Container nichts.
  const bundleModules = path.join(STANDALONE, "node_modules");
  const required = collectExternalRequires(SCRIPTS_DIST);
  const missing = [];

  for (const [specifier, users] of required) {
    if (!existsSync(path.join(bundleModules, packageNameOf(specifier)))) {
      missing.push({ specifier, users: [...new Set(users)] });
    }
  }

  if (missing.length > 0) {
    console.error("Fehlende Laufzeit-Abhängigkeiten im Standalone-Bundle:");
    for (const { specifier, users } of missing) {
      console.error(`  - ${specifier}  (benötigt von: ${users.join(", ")})`);
    }
    console.error("");
    console.error("Der Container würde beim Start in eine Crash-Loop laufen.");
    console.error("Abhilfe: scripts/bundle-script-deps.mjs ausführen (siehe deploy.sh).");
    process.exit(1);
  }

  console.log(`Skript-Abhängigkeiten vollständig (${required.size} geprüft).`);
}

main();

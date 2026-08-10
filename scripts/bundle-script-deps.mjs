#!/usr/bin/env node

// Next traced beim Standalone-Build nur, was Server-Routen zur Laufzeit als
// echtes Modul brauchen; alles andere kompiliert es in die Server-Chunks.
// Die Container-Skripte unter scripts-dist sind aber gewöhnliches tsc-Ergebnis
// und lösen ihre Pakete zur Laufzeit über /app/node_modules auf. Dieses Skript
// kopiert die fehlenden Pakete samt transitiver Abhängigkeiten ins Bundle.
// Gegenprüfung: scripts/check-script-deps.mjs.

import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectExternalRequires, packageNameOf } from "./lib/script-deps.mjs";

const SCRIPTS_DIST = path.resolve(process.argv[2] || "scripts-dist");
const STANDALONE = path.resolve(process.argv[3] || ".next/standalone");
// Viertes Argument nur für Tests: Verzeichnis, ab dem die Pakete aufgelöst werden.
const REPO_ROOT = path.resolve(
  process.argv[4] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
);
const BUNDLE_MODULES = path.join(STANDALONE, "node_modules");

function readManifest(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

// pnpm legt die Abhängigkeiten eines Pakets unter dessen eigenem
// .pnpm-Verzeichnis ab; deshalb wird ab dem echten Paketpfad nach oben gesucht.
function findPackageDir(pkg, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", pkg);
    if (existsSync(path.join(candidate, "package.json"))) {
      return realpathSync(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function main() {
  if (!existsSync(SCRIPTS_DIST) || !statSync(SCRIPTS_DIST).isDirectory()) {
    console.error(`Skript-Verzeichnis fehlt: ${SCRIPTS_DIST} (zuerst 'pnpm run build:scripts')`);
    process.exit(1);
  }
  if (!existsSync(BUNDLE_MODULES)) {
    console.error(`Standalone-Bundle fehlt: ${BUNDLE_MODULES} (zuerst 'pnpm run build')`);
    process.exit(1);
  }

  const scriptPackages = new Set(
    [...collectExternalRequires(SCRIPTS_DIST).keys()].map(packageNameOf)
  );
  const queue = [...scriptPackages].map((pkg) => ({ pkg, from: REPO_ROOT, parent: "scripts-dist" }));
  // pkg -> { version, parent } der Fassung, die tatsächlich im Bundle landet.
  const resolved = new Map();
  const copied = [];
  const unresolved = [];
  const conflicts = [];

  while (queue.length > 0) {
    const { pkg, from, parent } = queue.shift();

    const sourceDir = findPackageDir(pkg, from);
    if (!sourceDir) {
      if (!resolved.has(pkg)) unresolved.push(pkg);
      continue;
    }

    const manifest = readManifest(sourceDir);

    // pnpm hält je Anforderer eine eigene Fassung vor, das Bundle hat aber nur
    // ein flaches node_modules. Die zuerst gefundene gewinnt — verlangt ein
    // anderes Paket eine abweichende Version, bekommt es hier die falsche.
    const known = resolved.get(pkg);
    if (known) {
      if (known.version !== manifest.version) {
        conflicts.push(
          `${pkg}: ${known.version} (für ${known.parent}) wird verwendet, ` +
            `${parent} verlangt ${manifest.version}`
        );
      }
      continue;
    }
    resolved.set(pkg, { version: manifest.version, parent });

    // optionalDependencies zählen mit: sie fehlen im Bundle genauso, und ein
    // nicht auflösbares optionales Paket landet unten nur als Hinweis.
    const dependencies = {
      ...(manifest.dependencies || {}),
      ...(manifest.optionalDependencies || {}),
    };
    for (const dependency of Object.keys(dependencies)) {
      queue.push({ pkg: dependency, from: sourceDir, parent: pkg });
    }

    const target = path.join(BUNDLE_MODULES, pkg);
    if (existsSync(target)) {
      // Next hat das Paket beim Tracing schon abgelegt. Es wird nicht
      // überschrieben — die Server-Routen laufen dagegen —, aber eine
      // abweichende Version heißt: Die Skripte laufen gegen eine andere
      // Fassung, als ihre Auflösung ergeben hat.
      const bundled = readManifest(target).version;
      if (bundled && manifest.version && bundled !== manifest.version) {
        conflicts.push(
          `${pkg}: ${bundled} liegt bereits im Bundle (Next-Tracing), ` +
            `die Skripte lösen ${manifest.version} auf`
        );
      }
      continue;
    }

    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(sourceDir, target, { recursive: true, dereference: true });
    copied.push(pkg);
  }

  // Nicht auflösbar sind praktisch immer optionale Plattform-Pakete (etwa
  // Binaries für andere Architekturen). Fehlt etwas wirklich Benötigtes,
  // schlägt check-script-deps.mjs im Anschluss zu.
  if (unresolved.length > 0) {
    console.warn(`Nicht auffindbare (optionale) Pakete übersprungen: ${unresolved.join(", ")}`);
  }

  // Bewusst kein Abbruch: Ein Versionsunterschied ist oft folgenlos (Patch-Stand),
  // und ein harter Fehler würde das Deployment für einen Verdacht anhalten.
  // Sichtbar muss er trotzdem sein — sonst sucht niemand hier, wenn ein
  // Container-Skript unerklärlich anders läuft als auf dem Host.
  if (conflicts.length > 0) {
    console.warn(`\nWARNUNG: ${conflicts.length} Versionskonflikt(e) im Skript-Bundle:`);
    for (const conflict of conflicts) {
      console.warn(`  - ${conflict}`);
    }
    console.warn("Das flache node_modules des Bundles kann nur eine Fassung je Paket halten.\n");
  }

  console.log(
    copied.length > 0
      ? `Skript-Abhängigkeiten ergänzt (${copied.length}): ${copied.join(", ")}`
      : "Skript-Abhängigkeiten bereits vollständig."
  );
}

main();

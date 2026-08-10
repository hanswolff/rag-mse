import { builtinModules } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const builtins = new Set(builtinModules);
const REQUIRE_CALL = /require\(\s*["']([^"']+)["']\s*\)/g;

export function listJsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(full);
    return entry.isFile() && full.endsWith(".js") ? [full] : [];
  });
}

export function packageNameOf(specifier) {
  const clean = specifier.replace(/^node:/, "");
  const parts = clean.split("/");
  return clean.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Externe require()-Aufrufe eines Verzeichnisses, Spezifizierer auf die Dateien
 * abgebildet, die ihn brauchen. Node-Builtins und relative Pfade fallen weg.
 * @returns {Map<string, string[]>}
 */
export function collectExternalRequires(rootDir) {
  const found = new Map();
  for (const file of listJsFiles(rootDir)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(REQUIRE_CALL)) {
      const specifier = match[1];
      if (specifier.startsWith(".") || specifier.startsWith("/")) continue;
      if (builtins.has(packageNameOf(specifier))) continue;
      if (!found.has(specifier)) found.set(specifier, []);
      found.get(specifier).push(path.relative(rootDir, file));
    }
  }
  return found;
}

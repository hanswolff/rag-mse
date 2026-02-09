import fs from "node:fs";
import path from "node:path";

const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version: string };

const buildDate = new Date().toLocaleDateString("de-DE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const versionInfoPath = path.join(process.cwd(), "lib", "version-info.ts");
const versionInfoContent = `export const VERSION_INFO = {
  version: "${packageJson.version}",
  buildDate: "${buildDate}"
} as const;
`;

fs.writeFileSync(versionInfoPath, versionInfoContent, "utf8");
console.log(`Version info generated: ${packageJson.version} (${buildDate})`);

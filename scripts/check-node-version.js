#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0], 10);

// Nur Node 22: Das Produktions-Image ist node:22-slim und deploy.sh erzwingt 22 —
// andere Majors werden nie getestet (siehe engines in package.json).
if (major !== 22) {
  console.error(`Node.js 22.x is required. Current version: ${process.version}`);
  process.exit(1);
}

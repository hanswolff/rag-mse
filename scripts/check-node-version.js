#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (major !== 22 && major !== 24) {
  console.error(`Node.js 22.x or 24.x is required. Current version: ${process.version}`);
  process.exit(1);
}

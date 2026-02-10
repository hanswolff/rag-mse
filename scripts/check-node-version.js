#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (major !== 22) {
  console.error(`Node.js 22.x is required. Current version: ${process.version}`);
  process.exit(1);
}

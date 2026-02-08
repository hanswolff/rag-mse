#!/usr/bin/env tsx

import { validateProductionConfig, printValidationResults } from "../lib/config-validation";

console.log("Validating application configuration...");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log("");

const result = validateProductionConfig();
printValidationResults(result);

if (!result.isValid) {
  console.error("\n❌ Validation failed. Application cannot start.");
  process.exit(1);
}

console.log("\n✓ Configuration valid. Starting application...");

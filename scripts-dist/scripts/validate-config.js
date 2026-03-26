#!/usr/bin/env tsx
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_validation_1 = require("../lib/config-validation");
console.log("Validating application configuration...");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log("");
const result = (0, config_validation_1.validateProductionConfig)();
(0, config_validation_1.printValidationResults)(result);
if (!result.isValid) {
    console.error("\n❌ Validation failed. Application cannot start.");
    process.exit(1);
}
console.log("\n✓ Configuration valid. Starting application...");

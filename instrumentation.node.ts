import { logInfo, logError } from "@/lib/logger";
import { validateProductionConfig, printValidationResults } from "@/lib/config-validation";
import { startEmailOutboxWorker } from "@/lib/email-sender";
import { startEventReminderWorker } from "@/lib/event-reminder-worker";
import { VERSION_INFO } from "@/lib/version-info";

export function registerNode() {
  const appName = process.env.APP_NAME || "RAG Schießsport MSE";
  const nodeEnv = process.env.NODE_ENV || "unknown";
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  logInfo("app_startup", "Application starting", {
    appName,
    nodeEnv,
    appUrl,
    version: VERSION_INFO.version,
    buildDate: VERSION_INFO.buildDate,
  });

  const validation = validateProductionConfig();
  printValidationResults(validation);

  if (!validation.isValid) {
    logError("config_validation", "Configuration validation failed", {
      errors: validation.errors,
    });
    throw new Error(
      `Configuration validation failed: ${validation.errors.join(", ")}`
    );
  }

  process.on("unhandledRejection", (reason) => {
    logError("unhandled_rejection", "Unhandled rejection", { reason });
  });

  process.on("uncaughtException", (error) => {
    logError("uncaught_exception", "Uncaught exception", {
      error: error.message,
      stack: error.stack,
    });
  });

  startEmailOutboxWorker();
  startEventReminderWorker();
}

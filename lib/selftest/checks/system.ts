import { statfs } from "node:fs/promises";
import { validateProductionConfig } from "@/lib/config-validation";
import { getDocumentsDirectory } from "@/lib/document-storage";
import { isEmailOutboxWorkerRunning } from "@/lib/email/outbox-worker";
import { isEventReminderWorkerRunning } from "@/lib/event-reminder-worker";
import type { CheckVerdict, RegisteredCheck } from "../types";

const WORKER_COMPONENT = "Hintergrund-Worker";
const CONFIG_COMPONENT = "Konfiguration";
const DISK_COMPONENT = "Speicherplatz";

const DISK_WARN_BYTES = 500 * 1024 * 1024;
const DISK_ERROR_BYTES = 50 * 1024 * 1024;
const DISK_WARN_RATIO = 0.05;
const DISK_ERROR_RATIO = 0.01;

async function checkWorkers(): Promise<CheckVerdict> {
  // Workers are intentionally not started under the test runner.
  if (process.env.NODE_ENV === "test") {
    return { status: "skipped", message: "Worker-Prüfung im Test-Modus übersprungen" };
  }

  const outbox = isEmailOutboxWorkerRunning();
  const reminder = isEventReminderWorkerRunning();
  const stopped: string[] = [];
  if (!outbox) stopped.push("E-Mail-Versand");
  if (!reminder) stopped.push("Termin-Erinnerungen");

  // Workers start synchronously at boot before requests are served, so a stopped worker
  // here means a genuinely broken feature (no mail delivery / no reminders), not a race.
  if (stopped.length > 0) {
    return {
      status: "error",
      message: `Worker nicht aktiv: ${stopped.join(", ")}`,
      details: { outbox, reminder },
    };
  }

  return { status: "ok", message: "Alle Hintergrund-Worker aktiv", details: { outbox, reminder } };
}

async function checkConfig(): Promise<CheckVerdict> {
  const result = validateProductionConfig();

  if (result.errors.length > 0) {
    return {
      status: "error",
      message: result.errors.join("; "),
      details: { errors: result.errors, warnings: result.warnings },
    };
  }
  if (result.warnings.length > 0) {
    return {
      status: "warn",
      message: result.warnings.join("; "),
      details: { warnings: result.warnings },
    };
  }
  return { status: "ok", message: "Konfiguration gültig" };
}

async function checkDiskSpace(): Promise<CheckVerdict> {
  const directory = getDocumentsDirectory();
  const stats = await statfs(directory);
  const freeBytes = stats.bavail * stats.bsize;
  const totalBytes = stats.blocks * stats.bsize;
  const freeRatio = totalBytes > 0 ? stats.bavail / stats.blocks : 0;
  const freeMb = Math.round(freeBytes / (1024 * 1024));
  const details = { directory, freeBytes, totalBytes, freePercent: Math.round(freeRatio * 1000) / 10 };

  if (freeBytes < DISK_ERROR_BYTES || freeRatio < DISK_ERROR_RATIO) {
    return { status: "error", message: `Kritisch wenig Speicherplatz: ${freeMb} MB frei`, details };
  }
  if (freeBytes < DISK_WARN_BYTES || freeRatio < DISK_WARN_RATIO) {
    return { status: "warn", message: `Wenig Speicherplatz: ${freeMb} MB frei`, details };
  }
  return { status: "ok", message: `${freeMb} MB frei`, details };
}

export const systemChecks: RegisteredCheck[] = [
  { name: "system.workers", component: WORKER_COMPONENT, run: checkWorkers },
  { name: "system.config", component: CONFIG_COMPONENT, run: checkConfig },
  { name: "system.disk", component: DISK_COMPONENT, run: checkDiskSpace },
];

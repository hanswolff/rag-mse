import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";
import { PRUNED_ATTACHMENTS_MARKER } from "@/lib/email/types";

// Aufbewahrungsgrenzen (Code-Review): E-Mail-Anhänge (base64 inline) und
// verbrauchte/abgelaufene Token-Zeilen wachsen sonst unbegrenzt.
const ATTACHMENT_RETENTION_DAYS = 30;
const TOKEN_RETENTION_DAYS = 30;
const INVITATION_RETENTION_DAYS = 90;
const MAINTENANCE_INTERVAL_MS = 12 * 60 * 60 * 1000;

const globalForMaintenance = globalThis as unknown as {
  maintenanceWorkerStarted?: boolean;
  maintenanceTickRunning?: boolean;
  maintenanceTimer?: ReturnType<typeof setInterval>;
};

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export interface MaintenanceResult {
  clearedAttachments: number;
  clearedSensitiveTokens: number;
  deletedPasswordResets: number;
  deletedInvitations: number;
  deletedReminderDispatches: number;
}

export async function runMaintenanceCleanup(now: Date = new Date()): Promise<MaintenanceResult> {
  // Anhang-Blobs endgültig versendeter/fehlgeschlagener E-Mails leeren;
  // die Protokollzeile selbst bleibt für das Admin-E-Mail-Protokoll erhalten
  const clearedAttachments = await prisma.outgoingEmail.updateMany({
    where: {
      status: { in: ["SENT", "FAILED"] },
      attachmentsJson: { not: null, notIn: [PRUNED_ATTACHMENTS_MARKER] },
      createdAt: { lt: daysAgo(ATTACHMENT_RETENTION_DAYS, now) },
    },
    data: { attachmentsJson: PRUNED_ATTACHMENTS_MARKER },
  });

  // Einmal-Token fehlgeschlagener E-Mails (für den Admin-Retry aufbewahrt)
  // nach derselben Frist endgültig entfernen; danach ist kein Retry mehr möglich
  const clearedSensitiveTokens = await prisma.outgoingEmail.updateMany({
    where: {
      status: "FAILED",
      sensitiveTokensJson: { not: null },
      createdAt: { lt: daysAgo(TOKEN_RETENTION_DAYS, now) },
    },
    data: { sensitiveTokensJson: null },
  });

  const deletedPasswordResets = await prisma.passwordReset.deleteMany({
    where: {
      OR: [
        { usedAt: { lt: daysAgo(TOKEN_RETENTION_DAYS, now) } },
        { usedAt: null, expiresAt: { lt: daysAgo(TOKEN_RETENTION_DAYS, now) } },
      ],
    },
  });

  const deletedInvitations = await prisma.invitation.deleteMany({
    where: {
      OR: [
        { usedAt: { lt: daysAgo(INVITATION_RETENTION_DAYS, now) } },
        { usedAt: null, expiresAt: { lt: daysAgo(INVITATION_RETENTION_DAYS, now) } },
      ],
    },
  });

  // Dispatch-Zeilen dienen auch als Dedupe ("schon erinnert") — nur löschen,
  // wenn beide Token längst abgelaufen sind, also der Termin lange vorbei ist
  const deletedReminderDispatches = await prisma.eventReminderDispatch.deleteMany({
    where: {
      rsvpTokenExpiresAt: { lt: daysAgo(TOKEN_RETENTION_DAYS, now) },
      unsubscribeTokenExpiresAt: { lt: daysAgo(TOKEN_RETENTION_DAYS, now) },
    },
  });

  return {
    clearedAttachments: clearedAttachments.count,
    clearedSensitiveTokens: clearedSensitiveTokens.count,
    deletedPasswordResets: deletedPasswordResets.count,
    deletedInvitations: deletedInvitations.count,
    deletedReminderDispatches: deletedReminderDispatches.count,
  };
}

async function runMaintenanceTick(): Promise<void> {
  if (globalForMaintenance.maintenanceTickRunning) {
    return;
  }

  globalForMaintenance.maintenanceTickRunning = true;

  try {
    const result = await runMaintenanceCleanup();
    const total =
      result.clearedAttachments +
      result.clearedSensitiveTokens +
      result.deletedPasswordResets +
      result.deletedInvitations +
      result.deletedReminderDispatches;
    if (total > 0) {
      logInfo("maintenance_cleanup_completed", "Maintenance cleanup completed", { ...result });
    }
  } catch (error) {
    logError("maintenance_cleanup_failed", "Maintenance cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    globalForMaintenance.maintenanceTickRunning = false;
  }
}

export function startMaintenanceWorker(): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (globalForMaintenance.maintenanceWorkerStarted) {
    return;
  }

  globalForMaintenance.maintenanceWorkerStarted = true;

  globalForMaintenance.maintenanceTimer = setInterval(() => {
    void runMaintenanceTick();
  }, MAINTENANCE_INTERVAL_MS);

  void runMaintenanceTick();

  logInfo("maintenance_worker_started", "Maintenance worker started", {
    intervalMs: MAINTENANCE_INTERVAL_MS,
  });
}

export function stopMaintenanceWorkerForTests(): void {
  if (globalForMaintenance.maintenanceTimer) {
    clearInterval(globalForMaintenance.maintenanceTimer);
  }

  globalForMaintenance.maintenanceWorkerStarted = false;
  globalForMaintenance.maintenanceTickRunning = false;
}

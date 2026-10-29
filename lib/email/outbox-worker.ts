import nodemailer, { type Transporter } from "nodemailer";
import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { isPrismaErrorCode } from "../prisma-errors";
import { logError, logInfo } from "../logger";
import type { ClaimedOutgoingEmail } from "./types";
import { DEV_MODE_MESSAGE_ID_PREFIX, MAX_RETRY_WINDOW_MS } from "./types";
import { getWorkerConfig, getSmtpConfig, getSmtpTimeouts, getDevModeSmtpConfig } from "./config";
import { classifyEmailError } from "./error-classification";
import { isDevModeEnabled, logEmailInDevMode } from "./dev-mode";
import { parseRecipients, parseStoredAttachments, getNextRetryTimeForTransientFailure } from "./utils";
import { parseSensitiveTokens, restoreSensitiveLinkTokens } from "./redact";
import { createIntervalWorker } from "../worker-runtime";

const SENT_UPDATE_MAX_ATTEMPTS = 3;

let currentWorkerInstanceId: string | null = null;

export function isEmailOutboxWorkerRunning(): boolean {
  return emailOutboxWorker.isRunning();
}

export function createSmtpTransport(smtpConfig = getSmtpConfig()): Transporter {
  const { SMTP_TIMEOUT_MS, SMTP_CONNECTION_TIMEOUT_MS } = getSmtpTimeouts();

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.password,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

function buildClaimableWhere(now: Date) {
  return {
    OR: [
      {
        status: {
          in: [OutgoingEmailStatus.QUEUED, OutgoingEmailStatus.RETRYING],
        },
        nextAttemptAt: {
          lte: now,
        },
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lte: now } },
        ],
      },
      // PROCESSING mit abgelaufenem Lock: der Prozess ist mitten im Versand
      // gestorben (z. B. OOM-Kill); die Zeile wird erneut beansprucht.
      {
        status: OutgoingEmailStatus.PROCESSING,
        lockedUntil: { lte: now },
      },
    ],
  };
}

type ClaimResult = { email: ClaimedOutgoingEmail; reclaimedAfterAbort: boolean };

async function claimNextEmail(lockMs: number): Promise<ClaimResult | null> {
  const now = new Date();

  const nextEmail = await prisma.outgoingEmail.findFirst({
    where: buildClaimableWhere(now),
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });

  if (!nextEmail) {
    return null;
  }

  const claimed = await prisma.outgoingEmail.updateMany({
    where: {
      id: nextEmail.id,
      ...buildClaimableWhere(now),
    },
    data: {
      status: OutgoingEmailStatus.PROCESSING,
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      lockedUntil: new Date(now.getTime() + lockMs),
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  const email = await prisma.outgoingEmail.findUnique({
    where: { id: nextEmail.id },
  });

  if (!email) {
    return null;
  }

  // Platzhalter erst hier wieder durch die echten Einmal-Token ersetzen; gespeichert
  // bleiben sie nur in sensitiveTokensJson bis zum Abschluss des Versands.
  const sensitiveTokens = parseSensitiveTokens(email.sensitiveTokensJson);

  return {
    email: {
      ...email,
      textBody: restoreSensitiveLinkTokens(email.textBody, sensitiveTokens),
      htmlBody: restoreSensitiveLinkTokens(email.htmlBody, sensitiveTokens),
      toList: parseRecipients(email.toRecipients),
      attachments: parseStoredAttachments(email.attachmentsJson),
    },
    reclaimedAfterAbort: nextEmail.status === OutgoingEmailStatus.PROCESSING,
  };
}

async function sendEmailBySmtp(email: ClaimedOutgoingEmail): Promise<{ messageId?: string; filePath?: string }> {
  if (isDevModeEnabled()) {
    const logResult = await logEmailInDevMode(email, getDevModeSmtpConfig());
    return {
      messageId: `${DEV_MODE_MESSAGE_ID_PREFIX}${email.id}`,
      ...logResult,
    };
  }

  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);

  const result = await transporter.sendMail({
    from: smtpConfig.from,
    to: email.toList.join(", "),
    subject: email.subject,
    text: email.textBody,
    html: email.htmlBody,
    ...(email.attachments.length > 0 ? { attachments: email.attachments } : {}),
  });

  return { messageId: result.messageId };
}

// Übergabe an SMTP gelungen, SENT aber nicht gespeichert: Diese Einträge werden
// vor dem nächsten Claim nur noch als SENT markiert, nie erneut versendet.
const deliveredAwaitingSentUpdate = new Set<string>();

async function markSent(emailId: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SENT_UPDATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      await prisma.outgoingEmail.update({
        where: { id: emailId },
        data: {
          status: OutgoingEmailStatus.SENT,
          sentAt: new Date(),
          lockedUntil: null,
          lastError: null,
          // Token nach erfolgreichem Versand endgültig entfernen
          sensitiveTokensJson: null,
        },
      });
      deliveredAwaitingSentUpdate.delete(emailId);
      return;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        deliveredAwaitingSentUpdate.delete(emailId);
        return;
      }
      lastError = error;
    }
  }

  deliveredAwaitingSentUpdate.add(emailId);
  logError("email_sent_status_update_failed", "Email was sent but SENT status could not be saved", {
    outboxId: emailId,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  throw lastError;
}

async function confirmDeliveredEmails(): Promise<void> {
  for (const emailId of [...deliveredAwaitingSentUpdate]) {
    await markSent(emailId);
  }
}

async function failAbortedEmail(email: ClaimedOutgoingEmail): Promise<void> {
  const lastError = "Versand wiederholt abgebrochen, 24-Stunden-Fenster ausgeschöpft";
  await prisma.outgoingEmail.update({
    where: { id: email.id },
    data: {
      status: OutgoingEmailStatus.FAILED,
      lockedUntil: null,
      lastError,
    },
  });

  logError("email_send_failed", "Email send failed permanently", {
    outboxId: email.id,
    template: email.template,
    to: email.toRecipients,
    error: lastError,
    attemptCount: email.attemptCount,
    firstQueuedAt: email.firstQueuedAt.toISOString(),
  });
}

async function scheduleRetryOrFail(claimedEmail: ClaimedOutgoingEmail, error: unknown): Promise<void> {
  const now = new Date();
  const emailError = error instanceof Error ? error : new Error(String(error));
  const classified = classifyEmailError(emailError);

  // Nur eindeutig permanente Fehler sofort endgültig fehlschlagen lassen;
  // unbekannte Fehler (DNS, TLS, EPIPE, ...) werden wie transiente behandelt
  // und innerhalb des Retry-Fensters erneut versucht.
  const nextAttemptAt = classified.type === "permanent"
    ? null
    : getNextRetryTimeForTransientFailure(claimedEmail.attemptCount, claimedEmail.firstQueuedAt, now);

  if (nextAttemptAt) {
    await prisma.outgoingEmail.update({
      where: { id: claimedEmail.id },
      data: {
        status: OutgoingEmailStatus.RETRYING,
        nextAttemptAt,
        lockedUntil: null,
        lastError: classified.message,
      },
    });

    logError("email_send_retry_scheduled", "Email send failed, retry scheduled", {
      outboxId: claimedEmail.id,
      template: claimedEmail.template,
      to: claimedEmail.toRecipients,
      error: classified.message,
      attemptCount: claimedEmail.attemptCount,
      nextAttemptAt: nextAttemptAt.toISOString(),
    });
    return;
  }

  // sensitiveTokensJson bleibt bei FAILED erhalten, damit der manuelle
  // Admin-Retry funktionierende Links wiederherstellen kann; die Wartung
  // entfernt die Token nach Ablauf der Aufbewahrungsfrist endgültig.
  await prisma.outgoingEmail.update({
    where: { id: claimedEmail.id },
    data: {
      status: OutgoingEmailStatus.FAILED,
      lockedUntil: null,
      lastError: classified.message,
    },
  });

  logError("email_send_failed", "Email send failed permanently", {
    outboxId: claimedEmail.id,
    template: claimedEmail.template,
    to: claimedEmail.toRecipients,
    error: classified.message,
    attemptCount: claimedEmail.attemptCount,
    firstQueuedAt: claimedEmail.firstQueuedAt.toISOString(),
  });
}

async function processSingleEmail(lockMs: number): Promise<boolean> {
  const claim = await claimNextEmail(lockMs);

  if (!claim) {
    return false;
  }

  const { email: claimedEmail, reclaimedAfterAbort } = claim;

  // Ein Prozessabbruch mitten im Versand zählt als Versuch im 24-h-Fenster;
  // sonst würde eine Mail, die den Prozess abstürzen lässt, endlos wiederholt.
  if (reclaimedAfterAbort && Date.now() - claimedEmail.firstQueuedAt.getTime() >= MAX_RETRY_WINDOW_MS) {
    await failAbortedEmail(claimedEmail);
    return true;
  }

  let result: { messageId?: string; filePath?: string };
  try {
    result = await sendEmailBySmtp(claimedEmail);
  } catch (error) {
    await scheduleRetryOrFail(claimedEmail, error);
    return true;
  }

  await markSent(claimedEmail.id);

  const logContext = {
    outboxId: claimedEmail.id,
    template: claimedEmail.template,
    to: claimedEmail.toRecipients,
    attemptCount: claimedEmail.attemptCount,
  };

  if (isDevModeEnabled()) {
    logInfo("email_sent_dev_mode", "[DEV MODE] Email logged instead of sent via SMTP", {
      ...logContext,
      messageId: result.messageId,
      filePath: result.filePath,
    });
  } else {
    logInfo("email_sent", "Email sent successfully from outbox", {
      ...logContext,
      messageId: result.messageId,
    });
  }

  return true;
}

export async function processDueEmailOutboxBatch(): Promise<number> {
  const { batchSize, lockMs } = getWorkerConfig();
  let processed = 0;

  await confirmDeliveredEmails();

  for (let index = 0; index < batchSize; index += 1) {
    const hasProcessed = await processSingleEmail(lockMs);
    if (!hasProcessed) {
      break;
    }
    processed += 1;
  }

  return processed;
}

const emailOutboxWorker = createIntervalWorker({
  name: "email-outbox",
  getIntervalMs: () => getWorkerConfig().pollIntervalMs,
  tick: async () => {
    const processed = await processDueEmailOutboxBatch();
    if (processed > 0) {
      logInfo("email_outbox_batch_processed", "Processed pending outbox emails", {
        processed,
        workerInstanceId: currentWorkerInstanceId,
      });
    }
  },
  onTickError: (error) => {
    logError("email_outbox_worker_error", "Outbox worker tick failed", {
      error: error instanceof Error ? error.message : String(error),
      workerInstanceId: currentWorkerInstanceId,
    });
  },
  onStarted: (pollIntervalMs) => {
    // Instanz-ID unterscheidet Prozesse in den Logs (z. B. bei Neustarts)
    currentWorkerInstanceId = `${process.pid}-${Date.now()}`;
    logInfo("email_outbox_worker_started", "Email outbox worker started", {
      pollIntervalMs,
      workerInstanceId: currentWorkerInstanceId,
    });
  },
  onStopped: () => {
    currentWorkerInstanceId = null;
  },
});

export function startEmailOutboxWorker(): void {
  emailOutboxWorker.start();
}

export function stopEmailOutboxWorkerForTests(): void {
  emailOutboxWorker.stopForTests();
}

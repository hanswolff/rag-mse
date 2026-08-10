import nodemailer from "nodemailer";
import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { logError, logInfo } from "../logger";
import type { ClaimedOutgoingEmail } from "./types";
import { DEV_MODE_MESSAGE_ID_PREFIX } from "./types";
import { getWorkerConfig, getSmtpConfig, getSmtpTimeouts } from "./config";
import { classifyEmailError } from "./error-classification";
import { isDevModeEnabled, logEmailInDevMode } from "./dev-mode";
import { parseRecipients, parseStoredAttachments, getNextRetryTimeForTransientFailure } from "./utils";
import { parseSensitiveTokens, restoreSensitiveLinkTokens } from "./redact";

const globalForEmailOutbox = globalThis as typeof globalThis & {
  emailOutboxWorkerStarted?: boolean;
  emailOutboxTickRunning?: boolean;
  emailOutboxTimer?: NodeJS.Timeout;
};

let currentWorkerInstanceId: string | null = null;

export function isEmailOutboxWorkerRunning(): boolean {
  return globalForEmailOutbox.emailOutboxWorkerStarted === true;
}

export function createSmtpTransport(smtpConfig = getSmtpConfig()): nodemailer.Transporter {
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

async function claimNextEmail(lockMs: number): Promise<ClaimedOutgoingEmail | null> {
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
    ...email,
    textBody: restoreSensitiveLinkTokens(email.textBody, sensitiveTokens),
    htmlBody: restoreSensitiveLinkTokens(email.htmlBody, sensitiveTokens),
    toList: parseRecipients(email.toRecipients),
    attachments: parseStoredAttachments(email.attachmentsJson),
  };
}

async function sendEmailBySmtp(email: ClaimedOutgoingEmail): Promise<{ messageId?: string; filePath?: string }> {
  const smtpConfig = getSmtpConfig();

  if (isDevModeEnabled()) {
    const logResult = await logEmailInDevMode(email, smtpConfig);
    return {
      messageId: `${DEV_MODE_MESSAGE_ID_PREFIX}${email.id}`,
      ...logResult,
    };
  }

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

async function processSingleEmail(lockMs: number): Promise<boolean> {
  const claimedEmail = await claimNextEmail(lockMs);

  if (!claimedEmail) {
    return false;
  }

  try {
    const result = await sendEmailBySmtp(claimedEmail);

    await prisma.outgoingEmail.update({
      where: { id: claimedEmail.id },
      data: {
        status: OutgoingEmailStatus.SENT,
        sentAt: new Date(),
        lockedUntil: null,
        lastError: null,
        // Token nach erfolgreichem Versand endgültig entfernen
        sensitiveTokensJson: null,
      },
    });

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
  } catch (error) {
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
      return true;
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

    return true;
  }
}

export async function processDueEmailOutboxBatch(): Promise<number> {
  const { batchSize, lockMs } = getWorkerConfig();
  let processed = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const hasProcessed = await processSingleEmail(lockMs);
    if (!hasProcessed) {
      break;
    }
    processed += 1;
  }

  return processed;
}

async function runWorkerTick(): Promise<void> {
  if (globalForEmailOutbox.emailOutboxTickRunning) {
    return;
  }

  globalForEmailOutbox.emailOutboxTickRunning = true;

  try {
    const processed = await processDueEmailOutboxBatch();
    if (processed > 0) {
      logInfo("email_outbox_batch_processed", "Processed pending outbox emails", {
        processed,
        workerInstanceId: currentWorkerInstanceId,
      });
    }
  } catch (error) {
    logError("email_outbox_worker_error", "Outbox worker tick failed", {
      error: error instanceof Error ? error.message : String(error),
      workerInstanceId: currentWorkerInstanceId,
    });
  } finally {
    globalForEmailOutbox.emailOutboxTickRunning = false;
  }
}

export function startEmailOutboxWorker(): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (globalForEmailOutbox.emailOutboxWorkerStarted) {
    return;
  }

  globalForEmailOutbox.emailOutboxWorkerStarted = true;
  currentWorkerInstanceId = `${process.pid}-${Date.now()}`;
  const { pollIntervalMs } = getWorkerConfig();

  globalForEmailOutbox.emailOutboxTimer = setInterval(() => {
    void runWorkerTick();
  }, pollIntervalMs);

  void runWorkerTick();

  logInfo("email_outbox_worker_started", "Email outbox worker started", {
    pollIntervalMs,
    workerInstanceId: currentWorkerInstanceId,
  });
}

export function stopEmailOutboxWorkerForTests(): void {
  if (globalForEmailOutbox.emailOutboxTimer) {
    clearInterval(globalForEmailOutbox.emailOutboxTimer);
  }

  globalForEmailOutbox.emailOutboxWorkerStarted = false;
  globalForEmailOutbox.emailOutboxTickRunning = false;
  globalForEmailOutbox.emailOutboxTimer = undefined;
  currentWorkerInstanceId = null;
}

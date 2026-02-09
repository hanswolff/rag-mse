import nodemailer from "nodemailer";
import { OutgoingEmail, OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { renderEmailTemplate } from "./email-templates";
import { logError, logInfo } from "./logger";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

interface ErrorWithCode extends Error {
  code?: string;
}

type EmailErrorType = "transient" | "permanent" | "unknown";

interface ClassifiedEmailError {
  type: EmailErrorType;
  originalError: Error;
  message: string;
}

interface ClaimedOutgoingEmail extends OutgoingEmail {
  toList: string[];
}

const PERMANENT_ERROR_PATTERNS = [
  "invalid credentials",
  "authentication failed",
  "access denied",
  "sender address rejected",
  "recipient address rejected",
  "mailbox unavailable",
  "user unknown",
  "invalid login",
  "550",
  "553",
  "554",
] as const;

const TRANSIENT_ERROR_PATTERNS = [
  "timeout",
  "etimedout",
  "econnreset",
  "econnrefused",
  "enotfound",
  "network",
  "connection",
  "temporary",
  "rate limit",
  "421",
  "450",
  "451",
  "452",
  "454",
] as const;

const FAST_RETRY_DELAY_MS = 2 * 60 * 1000;
const SLOW_RETRY_DELAY_MS = 10 * 60 * 1000;
const FAST_RETRY_COUNT = 3;
const MAX_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_POLL_INTERVAL_MS = 10 * 1000;
const DEFAULT_LOCK_MS = 5 * 60 * 1000;

const globalForEmailOutbox = globalThis as typeof globalThis & {
  emailOutboxWorkerStarted?: boolean;
  emailOutboxTickRunning?: boolean;
  emailOutboxTimer?: NodeJS.Timeout;
};

let currentWorkerInstanceId: string | null = null;

function getWorkerConfig() {
  return {
    pollIntervalMs: parseInt(process.env.EMAIL_OUTBOX_POLL_INTERVAL_MS || `${DEFAULT_POLL_INTERVAL_MS}`, 10),
    batchSize: parseInt(process.env.EMAIL_OUTBOX_BATCH_SIZE || `${DEFAULT_BATCH_SIZE}`, 10),
    lockMs: parseInt(process.env.EMAIL_OUTBOX_LOCK_MS || `${DEFAULT_LOCK_MS}`, 10),
  };
}

function getSmtpTimeouts() {
  return {
    SMTP_TIMEOUT_MS: parseInt(process.env.SMTP_TIMEOUT_MS || "30000", 10),
    SMTP_CONNECTION_TIMEOUT_MS: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || "10000", 10),
  };
}

function getSmtpConfig(): SmtpConfig {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom) {
    throw new Error("E-Mail-Konfiguration unvollständig");
  }

  return {
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: smtpPort === "465",
    user: smtpUser,
    password: smtpPassword,
    from: smtpFrom,
  };
}

function classifyEmailError(error: Error): ClassifiedEmailError {
  const errorMessage = error.message.toLowerCase();
  const errorCode = (error as ErrorWithCode).code?.toLowerCase();

  const isPermanent = PERMANENT_ERROR_PATTERNS.some(
    pattern => errorMessage.includes(pattern) || errorCode === pattern
  );
  const isTransient = TRANSIENT_ERROR_PATTERNS.some(
    pattern => errorMessage.includes(pattern) || errorCode === pattern
  );

  if (isPermanent) {
    return {
      type: "permanent",
      originalError: error,
      message: `Permanent SMTP error: ${error.message}`,
    };
  }

  if (isTransient) {
    return {
      type: "transient",
      originalError: error,
      message: `Transient SMTP error: ${error.message}`,
    };
  }

  return {
    type: "unknown",
    originalError: error,
    message: `Unknown SMTP error: ${error.message}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlFromText(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br />");
}

function normalizeRecipients(to: string | string[]): string[] {
  const recipients = (Array.isArray(to) ? to : [to]).map(item => item.trim()).filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("Mindestens ein E-Mail-Empfänger ist erforderlich");
  }

  return recipients;
}

function parseRecipients(toRecipients: string): string[] {
  return toRecipients
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function getNextRetryTimeForTransientFailure(attemptCount: number, firstQueuedAt: Date, now: Date): Date | null {
  const elapsedMs = now.getTime() - firstQueuedAt.getTime();
  if (elapsedMs >= MAX_RETRY_WINDOW_MS) {
    return null;
  }

  const delayMs = attemptCount <= FAST_RETRY_COUNT ? FAST_RETRY_DELAY_MS : SLOW_RETRY_DELAY_MS;
  const nextAttemptAt = new Date(now.getTime() + delayMs);

  if (nextAttemptAt.getTime() - firstQueuedAt.getTime() > MAX_RETRY_WINDOW_MS) {
    return null;
  }

  return nextAttemptAt;
}

async function claimNextEmail(lockMs: number): Promise<ClaimedOutgoingEmail | null> {
  const now = new Date();

  const nextEmail = await prisma.outgoingEmail.findFirst({
    where: {
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
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });

  if (!nextEmail) {
    return null;
  }

  const claimed = await prisma.outgoingEmail.updateMany({
    where: {
      id: nextEmail.id,
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

  return {
    ...email,
    toList: parseRecipients(email.toRecipients),
  };
}

async function sendEmailBySmtp(email: ClaimedOutgoingEmail): Promise<{ messageId: string }> {
  const smtpConfig = getSmtpConfig();
  const { SMTP_TIMEOUT_MS, SMTP_CONNECTION_TIMEOUT_MS } = getSmtpTimeouts();

  const transporter = nodemailer.createTransport({
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

  const result = await transporter.sendMail({
    from: smtpConfig.from,
    to: email.toList.join(", "),
    subject: email.subject,
    text: email.textBody,
    html: email.htmlBody,
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
      },
    });

    logInfo("email_sent", "Email sent successfully from outbox", {
      outboxId: claimedEmail.id,
      template: claimedEmail.template,
      to: claimedEmail.toRecipients,
      messageId: result.messageId,
      attemptCount: claimedEmail.attemptCount,
    });

    return true;
  } catch (error) {
    const now = new Date();
    const emailError = error instanceof Error ? error : new Error(String(error));
    const classified = classifyEmailError(emailError);

    const nextAttemptAt = classified.type === "transient"
      ? getNextRetryTimeForTransientFailure(claimedEmail.attemptCount, claimedEmail.firstQueuedAt, now)
      : null;

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

export interface SendTemplateEmailOptions {
  template: string;
  variables: Record<string, string>;
  to: string | string[];
}

export { classifyEmailError };

export async function sendTemplateEmail({ template, variables, to }: SendTemplateEmailOptions) {
  const recipients = normalizeRecipients(to);
  const { subject, body } = await renderEmailTemplate(template, variables);

  const queuedEmail = await prisma.outgoingEmail.create({
    data: {
      template,
      toRecipients: recipients.join(", "),
      subject,
      textBody: body,
      htmlBody: buildHtmlFromText(body),
      status: OutgoingEmailStatus.QUEUED,
      nextAttemptAt: new Date(),
    },
  });

  logInfo("email_queued", "Email queued for background delivery", {
    outboxId: queuedEmail.id,
    template,
    to: queuedEmail.toRecipients,
  });

  return {
    queued: true,
    outboxId: queuedEmail.id,
  };
}

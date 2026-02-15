import nodemailer from "nodemailer";
import { OutgoingEmail, OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { renderEmailTemplate } from "./email-templates";
import { logError, logInfo } from "./logger";
import { constants as fsConstants, promises as fs } from "fs";
import path from "path";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

type DevLogMethod = "logger" | "file" | "both";

const DEV_MODE_MESSAGE_ID_PREFIX = "dev-mode-";

interface ErrorWithCode extends Error {
  code?: string;
}

type EmailErrorType = "transient" | "permanent" | "unknown";

function isValidDevLogMethod(value: string): value is DevLogMethod {
  return value === "logger" || value === "file" || value === "both";
}

interface ClassifiedEmailError {
  type: EmailErrorType;
  originalError: Error;
  message: string;
}

interface ClaimedOutgoingEmail extends OutgoingEmail {
  toList: string[];
  attachments: EmailAttachment[];
}

interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
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

function isDevModeEnabled(): boolean {
  return process.env.EMAIL_DEV_MODE === "true";
}

function getDevLogMethod(): DevLogMethod {
  const method = process.env.EMAIL_DEV_LOG_METHOD || "logger";
  return isValidDevLogMethod(method) ? method : "logger";
}

function getDevLogDir(): string {
  const configuredLogDir = process.env.EMAIL_DEV_LOG_DIR?.trim();
  const rawLogDir = configuredLogDir && configuredLogDir.length > 0
    ? configuredLogDir
    : path.resolve(process.cwd(), "data", "logs", "emails");
  return path.isAbsolute(rawLogDir) ? rawLogDir : path.resolve(process.cwd(), rawLogDir);
}

async function ensureWritableLogDirectory(): Promise<string> {
  const configuredLogDir = getDevLogDir();
  const fallbackLogDir = path.resolve(process.cwd(), "data", "logs", "emails");
  const tmpLogDir = path.resolve("/tmp", "rag-mse", "emails");
  const candidates = [configuredLogDir, fallbackLogDir, tmpLogDir].filter(
    (candidate, index, all) => all.indexOf(candidate) === index
  );

  const errors: string[] = [];

  for (const logDir of candidates) {
    try {
      await fs.mkdir(logDir, { recursive: true });
      await fs.access(logDir, fsConstants.W_OK);

      if (logDir !== configuredLogDir) {
        logInfo("email_log_dir_fallback_used", "Configured email log directory is not writable, using fallback", {
          configuredLogDir,
          fallbackLogDir: logDir,
        });
      }

      return logDir;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${logDir}: ${errorMessage}`);
      logError("email_log_dir_failed", "Failed to create or access email log directory", {
        logDir,
        error: errorMessage,
      });
    }
  }

  throw new Error(`No writable email log directory found (${errors.join("; ")})`);
}

async function writeEmailToFile(
  email: ClaimedOutgoingEmail,
  smtpConfig: SmtpConfig
): Promise<string> {
  try {
    const logDir = await ensureWritableLogDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const filename = `${timestamp}_${email.id}_${randomSuffix}.eml`;
    const filePath = path.join(logDir, filename);

    const outerBoundary = `mixed-${email.id}-${randomSuffix}`;
    const alternativeBoundary = `alternative-${email.id}-${randomSuffix}`;

    const emailParts: string[] = [
      `From: ${smtpConfig.from}`,
      `To: ${email.toList.join(", ")}`,
      `Subject: ${email.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
      "",
    ];

    const textPart = [
      `--${outerBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      `--${alternativeBoundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      email.textBody,
    ].join("\r\n");

    const htmlPart = [
      "",
      `--${alternativeBoundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      email.htmlBody,
      "",
      `--${alternativeBoundary}--`,
    ].join("\r\n");

    emailParts.push(textPart + htmlPart);

    for (const attachment of email.attachments) {
      emailParts.push(
        [
          `--${outerBoundary}`,
          `Content-Type: ${attachment.contentType || "application/octet-stream"}`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          `Content-Transfer-Encoding: base64`,
          "",
          Buffer.from(attachment.content, "utf8").toString("base64"),
          "",
        ].join("\r\n")
      );
    }

    emailParts.push(`--${outerBoundary}--`, "");

    await fs.writeFile(filePath, emailParts.join("\r\n"), "utf8");

    return filePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError("email_file_write_failed", "Failed to write email to file", {
      outboxId: email.id,
      template: email.template,
      error: errorMessage,
    });
    throw new Error(`Failed to write email to file: ${errorMessage}`);
  }
}

async function logEmailToConsole(email: ClaimedOutgoingEmail, smtpConfig: SmtpConfig): Promise<void> {
  logInfo("email_dev_mode_logged", "[DEV MODE] Email logged instead of sent via SMTP", {
    outboxId: email.id,
    template: email.template,
    to: email.toList.join(", "),
    from: smtpConfig.from,
    subject: email.subject,
    textBody: email.textBody,
    htmlBody: email.htmlBody,
  });
}

async function logEmailInDevMode(
  email: ClaimedOutgoingEmail,
  smtpConfig: SmtpConfig
): Promise<{ filePath?: string }> {
  const logMethod = getDevLogMethod();
  const result: { filePath?: string } = {};

  if (logMethod === "logger") {
    await logEmailToConsole(email, smtpConfig);
  } else if (logMethod === "file") {
    result.filePath = await writeEmailToFile(email, smtpConfig);
    logInfo("email_dev_mode_file_written", "[DEV MODE] Email written to file", {
      outboxId: email.id,
      template: email.template,
      to: email.toRecipients,
      filePath: result.filePath,
    });
  } else if (logMethod === "both") {
    await Promise.all([
      logEmailToConsole(email, smtpConfig),
      writeEmailToFile(email, smtpConfig).then(filePath => {
        result.filePath = filePath;
        logInfo("email_dev_mode_file_written", "[DEV MODE] Email written to file", {
          outboxId: email.id,
          template: email.template,
          to: email.toRecipients,
          filePath,
        });
      }),
    ]);
  }

  return result;
}

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

function getOutgoingSenderName(): string {
  return (process.env.APP_NAME || "RAG Schießsport MSE").trim() || "RAG Schießsport MSE";
}

function getSmtpFromAddress(smtpFrom: string): string {
  const trimmed = smtpFrom.trim();
  const angleMatch = /<([^>]+)>/.exec(trimmed);
  if (angleMatch && angleMatch[1]) {
    return angleMatch[1].trim();
  }
  return trimmed;
}

function escapeDisplayName(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatFromHeader(addressOrHeader: string): string {
  const address = getSmtpFromAddress(addressOrHeader);
  const displayName = getOutgoingSenderName();
  return `"${escapeDisplayName(displayName)}" <${address}>`;
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
    from: formatFromHeader(smtpFrom),
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

function normalizeAttachments(attachments: SendTemplateEmailOptions["attachments"]): EmailAttachment[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments
    .filter((attachment) => attachment && attachment.filename && attachment.content)
    .map((attachment) => ({
      filename: attachment.filename.trim(),
      content: attachment.content,
      ...(attachment.contentType ? { contentType: attachment.contentType.trim() } : {}),
    }))
    .filter((attachment) => attachment.filename.length > 0 && attachment.content.length > 0);
}

function serializeAttachments(attachments: EmailAttachment[]): string | null {
  if (attachments.length === 0) {
    return null;
  }

  return JSON.stringify(attachments);
}

function parseStoredAttachments(attachmentsJson: string | null | undefined): EmailAttachment[] {
  if (!attachmentsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(attachmentsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((attachment) => attachment && typeof attachment === "object")
      .map((attachment) => {
        const record = attachment as Record<string, unknown>;
        return {
          filename: typeof record.filename === "string" ? record.filename : "",
          content: typeof record.content === "string" ? record.content : "",
          contentType: typeof record.contentType === "string" ? record.contentType : undefined,
        };
      })
      .filter((attachment) => attachment.filename.length > 0 && attachment.content.length > 0);
  } catch {
    return [];
  }
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
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

export { classifyEmailError };

export async function sendTemplateEmail({ template, variables, to, attachments }: SendTemplateEmailOptions) {
  const recipients = normalizeRecipients(to);
  const normalizedAttachments = normalizeAttachments(attachments);
  const { subject, body } = await renderEmailTemplate(template, variables);

  const queuedEmail = await prisma.outgoingEmail.create({
    data: {
      template,
      toRecipients: recipients.join(", "),
      subject,
      textBody: body,
      htmlBody: buildHtmlFromText(body),
      attachmentsJson: serializeAttachments(normalizedAttachments),
      status: OutgoingEmailStatus.QUEUED,
      nextAttemptAt: new Date(),
    },
  });

  logInfo("email_queued", "Email queued for background delivery", {
    outboxId: queuedEmail.id,
    template,
    to: queuedEmail.toRecipients,
    attachmentCount: normalizedAttachments.length,
  });

  return {
    queued: true,
    outboxId: queuedEmail.id,
  };
}

import type { SmtpConfig } from "./types";
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_BATCH_SIZE, DEFAULT_LOCK_MS } from "./types";

export function getWorkerConfig() {
  return {
    pollIntervalMs: parseInt(process.env.EMAIL_OUTBOX_POLL_INTERVAL_MS || `${DEFAULT_POLL_INTERVAL_MS}`, 10),
    batchSize: parseInt(process.env.EMAIL_OUTBOX_BATCH_SIZE || `${DEFAULT_BATCH_SIZE}`, 10),
    lockMs: parseInt(process.env.EMAIL_OUTBOX_LOCK_MS || `${DEFAULT_LOCK_MS}`, 10),
  };
}

export function getSmtpTimeouts() {
  return {
    SMTP_TIMEOUT_MS: parseInt(process.env.SMTP_TIMEOUT_MS || "30000", 10),
    SMTP_CONNECTION_TIMEOUT_MS: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || "10000", 10),
  };
}

export function getOutgoingSenderName(): string {
  return (process.env.APP_NAME || "RAG Schießsport MSE").trim() || "RAG Schießsport MSE";
}

export function getSmtpFromAddress(smtpFrom: string): string {
  const trimmed = smtpFrom.trim();
  const angleMatch = /<([^>]+)>/.exec(trimmed);
  if (angleMatch && angleMatch[1]) {
    return angleMatch[1].trim();
  }
  return trimmed;
}

export function escapeDisplayName(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function formatFromHeader(addressOrHeader: string): string {
  const address = getSmtpFromAddress(addressOrHeader);
  const displayName = getOutgoingSenderName();
  return `"${escapeDisplayName(displayName)}" <${address}>`;
}

export function getSmtpConfig(): SmtpConfig {
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

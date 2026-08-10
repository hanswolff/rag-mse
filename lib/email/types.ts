import { OutgoingEmail } from "@prisma/client";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export type DevLogMethod = "logger" | "file" | "both";

export const DEV_MODE_MESSAGE_ID_PREFIX = "dev-mode-";

export interface ErrorWithCode extends Error {
  code?: string;
}

export type EmailErrorType = "transient" | "permanent" | "unknown";

export function isValidDevLogMethod(value: string): value is DevLogMethod {
  return value === "logger" || value === "file" || value === "both";
}

export interface ClassifiedEmailError {
  type: EmailErrorType;
  originalError: Error;
  message: string;
}

export interface ClaimedOutgoingEmail extends OutgoingEmail {
  toList: string[];
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export const PERMANENT_ERROR_PATTERNS = [
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

export const TRANSIENT_ERROR_PATTERNS = [
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

// Marker statt null beim Leeren von Anhang-Blobs: erlaubt zu erkennen,
// dass eine E-Mail Anhänge HATTE, die nicht mehr wiederherstellbar sind.
export const PRUNED_ATTACHMENTS_MARKER = "PRUNED";

export const FAST_RETRY_DELAY_MS = 2 * 60 * 1000;
export const SLOW_RETRY_DELAY_MS = 10 * 60 * 1000;
export const FAST_RETRY_COUNT = 3;
export const MAX_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_POLL_INTERVAL_MS = 10 * 1000;
export const DEFAULT_LOCK_MS = 5 * 60 * 1000;

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

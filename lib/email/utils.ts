import type { EmailAttachment, SendTemplateEmailOptions } from "./types";
import {
  FAST_RETRY_DELAY_MS,
  SLOW_RETRY_DELAY_MS,
  FAST_RETRY_COUNT,
  MAX_RETRY_WINDOW_MS,
} from "./types";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildHtmlFromText(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" style="color: #2563eb; text-decoration: underline;">$1</a>',
  );
  const body = linked.replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
<tr><td align="center" style="padding: 24px;">
<div style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
${body}
</div>
</td></tr>
</table>
</body>
</html>`;
}

export function normalizeRecipients(to: string | string[]): string[] {
  const recipients = (Array.isArray(to) ? to : [to]).map(item => item.trim()).filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("Mindestens ein E-Mail-Empfänger ist erforderlich");
  }

  return recipients;
}

export function parseRecipients(toRecipients: string): string[] {
  return toRecipients
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function normalizeAttachments(attachments: SendTemplateEmailOptions["attachments"]): EmailAttachment[] {
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

export function serializeAttachments(attachments: EmailAttachment[]): string | null {
  if (attachments.length === 0) {
    return null;
  }

  return JSON.stringify(attachments);
}

export function parseStoredAttachments(attachmentsJson: string | null | undefined): EmailAttachment[] {
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

import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { renderEmailTemplate } from "./email-templates";
import { logInfo } from "./logger";
import type { SendTemplateEmailOptions } from "./email/types";
import { normalizeRecipients, normalizeAttachments, serializeAttachments, buildHtmlFromText } from "./email/utils";
import { extractSensitiveLinkTokens, serializeSensitiveTokens } from "./email/redact";

export type { SendTemplateEmailOptions } from "./email/types";
export { classifyEmailError } from "./email/error-classification";
export { getNextRetryTimeForTransientFailure } from "./email/utils";
export { processDueEmailOutboxBatch, startEmailOutboxWorker, stopEmailOutboxWorkerForTests, isEmailOutboxWorkerRunning, createSmtpTransport } from "./email/outbox-worker";

// client erlaubt das Einreihen innerhalb einer bestehenden Transaktion
export async function sendTemplateEmail(
  { template, variables, to, attachments }: SendTemplateEmailOptions,
  client: Pick<typeof prisma, "outgoingEmail"> = prisma
) {
  const recipients = normalizeRecipients(to);
  const normalizedAttachments = normalizeAttachments(attachments);
  const { subject, body } = await renderEmailTemplate(template, variables);

  // Einmal-Token durch Platzhalter ersetzen: Der gespeicherte Body enthält keine
  // funktionierenden Reset-/Einladungslinks mehr, der Worker setzt sie beim Versand
  // wieder ein und löscht sie danach.
  const { redacted, tokens } = extractSensitiveLinkTokens([body, buildHtmlFromText(body)]);
  const [storedTextBody, storedHtmlBody] = redacted;

  const queuedEmail = await client.outgoingEmail.create({
    data: {
      template,
      toRecipients: recipients.join(", "),
      subject,
      textBody: storedTextBody,
      htmlBody: storedHtmlBody,
      attachmentsJson: serializeAttachments(normalizedAttachments),
      sensitiveTokensJson: serializeSensitiveTokens(tokens),
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

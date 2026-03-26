import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { renderEmailTemplate } from "./email-templates";
import { logInfo } from "./logger";
import type { SendTemplateEmailOptions } from "./email/types";
import { normalizeRecipients, normalizeAttachments, serializeAttachments, buildHtmlFromText } from "./email/utils";

export type { SendTemplateEmailOptions } from "./email/types";
export { classifyEmailError } from "./email/error-classification";
export { getNextRetryTimeForTransientFailure } from "./email/utils";
export { processDueEmailOutboxBatch, startEmailOutboxWorker, stopEmailOutboxWorkerForTests } from "./email/outbox-worker";

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

import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { applyEmailTemplate, loadEmailTemplate, renderEmailTemplate, type EmailTemplate } from "./email-templates";
import { logInfo } from "./logger";
import type { SendTemplateEmailOptions } from "./email/types";
import { normalizeRecipients, normalizeAttachments, serializeAttachments, buildHtmlFromText } from "./email/utils";
import { extractSensitiveLinkTokens, serializeSensitiveTokens } from "./email/redact";

export type RenderedEmail = ReturnType<typeof buildRenderedEmail>;

function buildRenderedEmail(
  template: string,
  { subject, body }: EmailTemplate,
  { to, attachments }: Pick<SendTemplateEmailOptions, "to" | "attachments">
) {
  const recipients = normalizeRecipients(to);
  const normalizedAttachments = normalizeAttachments(attachments);

  // Einmal-Token durch Platzhalter ersetzen: Der gespeicherte Body enthält keine
  // funktionierenden Reset-/Einladungslinks mehr, der Worker setzt sie beim Versand
  // wieder ein und löscht sie danach.
  const { redacted, tokens } = extractSensitiveLinkTokens([body, buildHtmlFromText(body)]);
  const [textBody, htmlBody] = redacted;

  return { template, recipients, subject, textBody, htmlBody, tokens, attachments: normalizedAttachments };
}

// Rendern (Template-Dateien lesen) getrennt vom Einreihen, damit Transaktionen
// nur noch DB-Zugriffe enthalten (ADR 0012).
export async function renderTemplateEmail({ template, variables, to, attachments }: SendTemplateEmailOptions) {
  return buildRenderedEmail(template, await renderEmailTemplate(template, variables), { to, attachments });
}

// Für Serien-Mails: Vorlage einmal laden, danach synchron je Empfänger rendern.
export async function createTemplateEmailRenderer(template: string) {
  const loaded = await loadEmailTemplate(template);
  return ({ variables, to, attachments }: Omit<SendTemplateEmailOptions, "template">): RenderedEmail =>
    buildRenderedEmail(template, applyEmailTemplate(loaded, variables), { to, attachments });
}

export async function enqueueRenderedEmail(
  email: RenderedEmail,
  client: Pick<typeof prisma, "outgoingEmail"> = prisma
) {
  const queuedEmail = await client.outgoingEmail.create({
    data: {
      template: email.template,
      toRecipients: email.recipients.join(", "),
      subject: email.subject,
      textBody: email.textBody,
      htmlBody: email.htmlBody,
      attachmentsJson: serializeAttachments(email.attachments),
      sensitiveTokensJson: serializeSensitiveTokens(email.tokens),
      status: OutgoingEmailStatus.QUEUED,
      nextAttemptAt: new Date(),
    },
  });

  logInfo("email_queued", "Email queued for background delivery", {
    outboxId: queuedEmail.id,
    template: email.template,
    to: queuedEmail.toRecipients,
    attachmentCount: email.attachments.length,
  });

  return {
    queued: true,
    outboxId: queuedEmail.id,
  };
}

export async function sendTemplateEmail(options: SendTemplateEmailOptions) {
  return enqueueRenderedEmail(await renderTemplateEmail(options));
}

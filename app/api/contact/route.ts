import { NextRequest, NextResponse } from "next/server";
import { validateContactFormData, ContactFormData } from "@/lib/contact-validation";
import { checkRateLimitWithPolicy } from "@/lib/api-utils";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logWarn, logValidationFailure, logError } from "@/lib/logger";
import { getClientIdentifier } from "@/lib/proxy-trust";
import { checkContactRateLimit } from "@/lib/rate-limiter";

const ROUTE = "/api/contact";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const contactSchema = {
  name: { type: 'string' as const },
  email: { type: 'string' as const },
  message: { type: 'string' as const },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const clientId = getClientIdentifier(request);
  const rateLimitResult = await checkRateLimitWithPolicy(
    () => checkContactRateLimit(clientId, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS),
    {
      unavailableAction: "rate_limit_unavailable",
      routeLabel: "contact",
      logContext: { clientId, route: ROUTE, method: "POST" },
    }
  );
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }
  if (!rateLimitResult.allowed) {
    logWarn('rate_limit_exceeded', 'Contact form rate limit exceeded', {
      clientId,
      attemptCount: rateLimitResult.attemptCount,
      route: ROUTE,
      method: "POST",
    });
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const body = await parseAndValidateBody<Record<string, unknown>>(request, contactSchema, { route: ROUTE, method: 'POST' });

  const formData: ContactFormData = {
    name: typeof body.name === "string" ? body.name.trim() : "",
    email: typeof body.email === "string" ? body.email.trim() : "",
    message: typeof body.message === "string" ? body.message.trim() : "",
  };

  const validation = validateContactFormData(formData);

  if (!validation.isValid) {
    logValidationFailure(ROUTE, 'POST', validation.errors, {
      clientId,
    });
    // Die Kontakt-Seite liest bewusst `errors` als Liste (app/kontakt/page.tsx)
    throw new ValidationError(validation.errors, { fieldErrors: validation.fieldErrors, format: "errors" });
  }

  const adminEmails = process.env.ADMIN_EMAILS;

  if (!adminEmails) {
    logError('contact_failed', 'ADMIN_EMAILS not configured', {
      route: ROUTE,
      method: "POST",
      status: 500,
    });
    return NextResponse.json(
      { error: "E-Mail-Konfiguration unvollständig. Bitte kontaktieren Sie den Administrator." },
      { status: 500 }
    );
  }

  const recipients = adminEmails
    .split(",")
    .map(email => email.trim())
    .filter(email => email.length > 0);

  if (recipients.length === 0) {
    logError('contact_failed', 'ADMIN_EMAILS contains no valid recipients', {
      route: ROUTE,
      method: "POST",
      status: 500,
      configuredRecipientCount: adminEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0).length,
    });
    return NextResponse.json(
      { error: "E-Mail-Konfiguration fehlerhaft. Bitte kontaktieren Sie den Administrator." },
      { status: 500 }
    );
  }

  try {
    await sendTemplateEmail({
      template: "contact",
      variables: {
        name: formData.name,
        email: formData.email,
        message: formData.message,
      },
      to: recipients,
    });
  } catch (emailError) {
    logError('contact_email_failed', 'Failed to send contact email', {
      route: ROUTE,
      method: "POST",
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
    return NextResponse.json(
      { error: "Fehler beim Senden der Nachricht. Bitte versuchen Sie es später erneut." },
      { status: 500 }
    );
  }

  logInfo('contact_submitted', 'Contact form submitted and email queued', {
    messageLength: formData.message.length,
    recipientCount: recipients.length,
  });

  return NextResponse.json(
    { message: "Ihre Nachricht wurde erfolgreich gesendet." },
    { status: 200 }
  );
}, { route: ROUTE, method: "POST" });

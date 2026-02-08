import { NextRequest, NextResponse } from "next/server";
import { validateContactFormData, ContactFormData } from "@/lib/contact-validation";
import { BadRequestError, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logWarn, logValidationFailure, logError } from "@/lib/logger";
import { getClientIdentifier } from "@/lib/proxy-trust";
import { checkContactRateLimit } from "@/lib/rate-limiter";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const contactSchema = {
  name: { type: 'string' as const },
  email: { type: 'string' as const },
  message: { type: 'string' as const },
} as const;

export async function POST(request: NextRequest) {
  try {
    validateCsrfHeaders(request);

    const clientId = getClientIdentifier(request);
    try {
      const rateLimitResult = await checkContactRateLimit(clientId, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
      if (!rateLimitResult.allowed) {
        logWarn('rate_limit_exceeded', 'Contact form rate limit exceeded', {
          clientId,
          attemptCount: rateLimitResult.attemptCount,
          route: "/api/contact",
          method: "POST",
        });
        return NextResponse.json(
          { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
          { status: 429 }
        );
      }
    } catch (rateLimitError) {
      logWarn('rate_limit_unavailable', 'Rate limiter unavailable for contact route, continuing without enforcement', {
        clientId,
        route: "/api/contact",
        method: "POST",
        error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
      });
    }

    const body = await parseJsonBody<Record<string, unknown>>(request);

    const bodyValidation = validateRequestBody(body, contactSchema, { route: '/api/contact', method: 'POST' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const formData: ContactFormData = {
      name: typeof body.name === "string" ? body.name.trim() : "",
      email: typeof body.email === "string" ? body.email.trim() : "",
      message: typeof body.message === "string" ? body.message.trim() : "",
    };

    const validation = validateContactFormData(formData);

    if (!validation.isValid) {
      logValidationFailure('/api/contact', 'POST', validation.errors, {
        clientId,
      });
      return NextResponse.json(
        { errors: validation.errors },
        { status: 400 }
      );
    }

    const adminEmails = process.env.ADMIN_EMAILS;

    if (!adminEmails) {
      logError('contact_failed', 'ADMIN_EMAILS not configured', {
        route: "/api/contact",
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
        route: "/api/contact",
        method: "POST",
        status: 500,
        adminEmails,
      });
      return NextResponse.json(
        { error: "E-Mail-Konfiguration fehlerhaft. Bitte kontaktieren Sie den Administrator." },
        { status: 500 }
      );
    }

    await sendTemplateEmail({
      template: "contact",
      variables: {
        name: formData.name,
        email: formData.email,
        message: formData.message,
      },
      to: recipients,
    });

    logInfo('contact_submitted', 'Contact form submitted and email queued', {
      name: formData.name,
      email: formData.email,
      messageLength: formData.message.length,
      recipients,
    });

    return NextResponse.json(
      { message: "Ihre Nachricht wurde erfolgreich gesendet." },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logApiError(error, {
      route: "/api/contact",
      method: "POST",
      status: 500,
    });

    return NextResponse.json(
      { error: "Fehler beim Senden der Nachricht. Bitte versuchen Sie es später erneut." },
      { status: 500 }
    );
  }
}

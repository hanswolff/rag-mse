import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, validateRequestBody, getClientIp, handleRateLimitBlocked, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import {
  generateResetToken,
  hashResetToken,
  getResetExpiryDate,
  buildResetUrl,
} from "@/lib/password-reset";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logValidationFailure, logError, logWarn, maskEmail } from "@/lib/logger";
import { checkForgotPasswordRateLimit } from "@/lib/rate-limiter";
import { validateEmail } from "@/lib/validation-schema";
import { shouldFailOpenOnRateLimiterError } from "@/lib/rate-limit-policy";
import { appName } from "@/lib/site-config";

const SUCCESS_MESSAGE =
  "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link zum Zurücksetzen Ihres Passworts.";

interface ForgotPasswordRequest {
  email: string;
}

const forgotPasswordSchema = {
  email: { type: 'string' as const },
} as const;

// Wie beim Login: Fallback auf die Original-Schreibweise für Alt-Datensätze
// mit nicht kleingeschriebener E-Mail.
async function findUserByEmail(normalizedEmail: string, originalEmail: string) {
  const select = { id: true, email: true, role: true, activatedAt: true };
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select });
  if (user || normalizedEmail === originalEmail) {
    return user;
  }
  return prisma.user.findUnique({ where: { email: originalEmail }, select });
}

async function createPasswordReset(email: string) {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = getResetExpiryDate();

  await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
    await tx.passwordReset.deleteMany({
      where: { email },
    });

    await tx.passwordReset.create({
      data: {
        email,
        tokenHash,
        expiresAt,
      },
    });
  });

  return token;
}

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const body = await parseJsonBody<ForgotPasswordRequest>(request);

  const bodyValidation = validateRequestBody(body, forgotPasswordSchema, { route: '/api/auth/forgot-password', method: 'POST' });
  if (!bodyValidation.isValid) {
    return NextResponse.json(
      { error: bodyValidation.errors.join(". ") },
      { status: 400 }
    );
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  const email = rawEmail.toLowerCase();

  if (!email || !validateEmail(email)) {
    logValidationFailure('/api/auth/forgot-password', 'POST', 'Gültige E-Mail-Adresse erforderlich', { email: maskEmail(email) });
    return NextResponse.json(
      { error: "Gültige E-Mail-Adresse erforderlich" },
      { status: 400 }
    );
  }

  const clientIp = getClientIp(request);
  let rateLimitResult = { allowed: true, attemptCount: 0 } as {
    allowed: boolean;
    blockedUntil?: number;
    attemptCount: number;
  };
  try {
    rateLimitResult = await checkForgotPasswordRateLimit(clientIp, email);
  } catch (rateLimitError) {
    if (!shouldFailOpenOnRateLimiterError()) {
      logError("forgot_password_rate_limit_unavailable", "Rate limiter unavailable for forgot-password route, blocking request", {
        route: "/api/auth/forgot-password",
        method: "POST",
        clientIp,
        email: maskEmail(email),
        error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
      });
      return NextResponse.json(
        { error: "Dienst aktuell nicht verfügbar. Bitte später erneut versuchen." },
        { status: 503 }
      );
    }

    logWarn('forgot_password_rate_limit_unavailable', 'Rate limiter unavailable for forgot-password route, continuing due fail-open policy', {
      route: "/api/auth/forgot-password",
      method: "POST",
      clientIp,
      email: maskEmail(email),
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    });
  }

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      'forgot_password_rate_limited',
      '/api/auth/forgot-password',
      email,
      clientIp,
      rateLimitResult.blockedUntil,
      rateLimitResult.attemptCount
    );
  }

  const user = await findUserByEmail(email, rawEmail);

  if (user) {
    const userNeedsActivation = !user.activatedAt;

    if (userNeedsActivation) {
      // Keine Sonderantwort: Sonst ließe sich abfragen, welche Adressen
      // ein (noch nicht aktiviertes) Konto haben.
      logInfo('password_reset_skipped_inactive', 'Password reset requested for not-yet-activated account', {
        email: maskEmail(user.email),
      });
      return NextResponse.json({
        message: SUCCESS_MESSAGE,
      });
    }

    const token = await createPasswordReset(user.email);
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const resetUrl = buildResetUrl(appUrl, token);

    await sendTemplateEmail({
      template: "passwort-zuruecksetzen",
      variables: {
        resetUrl,
        appName,
      },
      to: user.email,
    });
    logInfo('password_reset_requested', 'Password reset requested and email queued', {
      email: maskEmail(user.email),
    });
  }

  return NextResponse.json({
    message: SUCCESS_MESSAGE,
  });
}, { route: "/api/auth/forgot-password", method: "POST" });

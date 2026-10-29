import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimitWithPolicy, getClientIp, handleRateLimitBlocked } from "@/lib/api-utils";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import {
  generateResetToken,
  hashResetToken,
  getResetExpiryDate,
  buildResetUrl,
} from "@/lib/password-reset";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logValidationFailure, maskEmail } from "@/lib/logger";
import { checkForgotPasswordRateLimit } from "@/lib/rate-limiter";
import { validateEmail } from "@/lib/validation-schema";
import { appName, getAppUrl } from "@/lib/site-config";

const ROUTE = "/api/auth/forgot-password";

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

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

  const body = await parseAndValidateBody<ForgotPasswordRequest>(request, forgotPasswordSchema, { route: ROUTE, method: 'POST' });

  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  const email = rawEmail.toLowerCase();

  if (!email || !validateEmail(email)) {
    logValidationFailure(ROUTE, 'POST', 'Gültige E-Mail-Adresse erforderlich', { email: maskEmail(email) });
    return NextResponse.json(
      { error: "Gültige E-Mail-Adresse erforderlich" },
      { status: 400 }
    );
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimitWithPolicy(
    () => checkForgotPasswordRateLimit(clientIp, email),
    {
      unavailableAction: "forgot_password_rate_limit_unavailable",
      routeLabel: "forgot-password",
      logContext: { route: ROUTE, method: "POST", clientIp, email: maskEmail(email) },
    }
  );
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      'forgot_password_rate_limited',
      ROUTE,
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

    const appUrl = getAppUrl();
    const token = await createPasswordReset(user.email);
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
}, { route: ROUTE, method: "POST" });

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, validateRequestBody, getClientIp, handleRateLimitBlocked, validateCsrfHeaders } from "@/lib/api-utils";
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

const SUCCESS_MESSAGE =
  "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link zum Zurücksetzen Ihres Passworts.";

interface ForgotPasswordRequest {
  email: string;
}

const forgotPasswordSchema = {
  email: { type: 'string' as const },
} as const;

async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, passwordUpdatedAt: true },
  });
}

async function hasPendingInvitation(email: string): Promise<boolean> {
  const invitation = await prisma.invitation.findFirst({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  return Boolean(invitation);
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

export async function POST(request: NextRequest) {
  try {
    validateCsrfHeaders(request);

    const body = await parseJsonBody<ForgotPasswordRequest>(request);

    const bodyValidation = validateRequestBody(body, forgotPasswordSchema, { route: '/api/auth/forgot-password', method: 'POST' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

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

    const user = await findUserByEmail(email);

    if (user) {
      const userNeedsActivation = !user.passwordUpdatedAt && await hasPendingInvitation(email);

      if (userNeedsActivation) {
        return NextResponse.json({
          message: SUCCESS_MESSAGE,
        });
      }

      const token = await createPasswordReset(email);
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const resetUrl = buildResetUrl(appUrl, token);

      try {
        await sendTemplateEmail({
          template: "passwort-zuruecksetzen",
          variables: {
            resetUrl,
            appName: "RAG Schießsport MSE",
          },
          to: email,
        });
        logInfo('password_reset_requested', 'Password reset requested and email queued', {
          email: maskEmail(email),
        });
      } catch (emailError) {
        logError('email_queue_failed', 'Failed to queue password reset email', {
          template: "passwort-zuruecksetzen",
          to: maskEmail(email),
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: SUCCESS_MESSAGE,
    });
  } catch (error: unknown) {
    logError('forgot_password_error', 'Error processing forgot password request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        message: SUCCESS_MESSAGE,
      },
      { status: 200 }
    );
  }
}

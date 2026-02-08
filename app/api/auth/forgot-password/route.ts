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
import { logInfo, logValidationFailure, logError } from "@/lib/logger";
import { checkForgotPasswordRateLimit } from "@/lib/rate-limiter";

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
    select: { id: true, email: true },
  });
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

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, forgotPasswordSchema, { route: '/api/auth/forgot-password', method: 'POST' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      logValidationFailure('/api/auth/forgot-password', 'POST', 'Gültige E-Mail-Adresse erforderlich', { email });
      return NextResponse.json(
        { error: "Gültige E-Mail-Adresse erforderlich" },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const rateLimitResult = await checkForgotPasswordRateLimit(clientIp, email);

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
      const token = await createPasswordReset(email);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
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
          email,
        });
      } catch (emailError) {
        logError('email_queue_failed', 'Failed to queue password reset email', {
          template: "passwort-zuruecksetzen",
          to: email,
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

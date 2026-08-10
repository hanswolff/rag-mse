import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  getNoCacheHeaders,
  handleRateLimitBlocked,
  parseJsonBody,
  checkTokenRateLimitWithPolicy,
  recordSuccessfulTokenUsageWithPolicy,
  validateRequestBody,
  validateCsrfHeaders,
  withApiErrorHandling,
} from "@/lib/api-utils";
import { hash } from "bcryptjs";
import { validatePassword } from "@/lib/password-validation";
import { hashResetToken } from "@/lib/password-reset";
import { logInfo, logValidationFailure, logResourceNotFound, maskToken, maskEmail } from "@/lib/logger";

const BCRYPT_SALT_ROUNDS = 10;

// Zwei parallele Submissions dürfen den Token nur einmal verbrauchen
class ResetTokenAlreadyUsedError extends Error {}

interface ResetPasswordRequest {
  password: string;
}

const resetPasswordSchema = {
  password: { type: 'string' as const },
} as const;

async function findValidResetToken(token: string) {
  const tokenHash = hashResetToken(token);
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
  });

  if (!reset) {
    return { reset: null, status: 404 };
  }

  if (reset.usedAt) {
    return { reset: null, status: 410 };
  }

  if (reset.expiresAt <= new Date()) {
    return { reset: null, status: 410 };
  }

  return { reset, status: 200 };
}

export const GET = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) => {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400, headers: getNoCacheHeaders() });
  }

  const clientIp = getClientIp(request);
  const tokenHash = hashResetToken(token);
  const rateLimitResult = await checkTokenRateLimitWithPolicy(
    "/api/auth/reset-password/[token]",
    "GET",
    clientIp,
    tokenHash,
    maskToken(token),
    "read"
  );

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      'password_reset_rate_limited',
      '/api/auth/reset-password/[token]',
      token,
      clientIp,
      rateLimitResult.blockedUntil,
      rateLimitResult.attemptCount
    );
  }

  const { reset, status } = await findValidResetToken(token);
  if (!reset) {
    const message = status === 410 ? "Der Link ist abgelaufen" : "Ungültiger Link";
    return NextResponse.json({ error: message }, { status, headers: getNoCacheHeaders() });
  }

  return NextResponse.json(
    {
      email: reset.email,
      expiresAt: reset.expiresAt,
    },
    { headers: getNoCacheHeaders() }
  );
}, { route: "/api/auth/reset-password/[token]", method: "GET" });

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) => {
  validateCsrfHeaders(request);

  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const tokenHash = hashResetToken(token);
  const rateLimitResult = await checkTokenRateLimitWithPolicy(
    "/api/auth/reset-password/[token]",
    "POST",
    clientIp,
    tokenHash,
    maskToken(token)
  );

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      'password_reset_rate_limited',
      '/api/auth/reset-password/[token]',
      token,
      clientIp,
      rateLimitResult.blockedUntil,
      rateLimitResult.attemptCount
    );
  }

  const body = await parseJsonBody<ResetPasswordRequest>(request);

  const bodyValidation = validateRequestBody(body, resetPasswordSchema, { route: '/api/auth/reset-password/[token]', method: 'POST' });
  if (!bodyValidation.isValid) {
    return NextResponse.json(
      { error: bodyValidation.errors.join(". ") },
      { status: 400 }
    );
  }

  const password = typeof body.password === "string" ? body.password : "";

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    logValidationFailure('/api/auth/reset-password/[token]', 'POST', passwordValidation.errors, { token: maskToken(token) });
    return NextResponse.json(
      { error: passwordValidation.errors.join(". ") },
      { status: 400 }
    );
  }

  const { reset, status } = await findValidResetToken(token);
  if (!reset) {
    const message = status === 410 ? "Der Link ist abgelaufen" : "Ungültiger Link";
    logResourceNotFound('password_reset', maskToken(token), '/api/auth/reset-password/[token]', 'POST', {
      reason: status === 410 ? 'expired' : 'invalid',
    });
    return NextResponse.json({ error: message }, { status });
  }

  const user = await prisma.user.findUnique({
    where: { email: reset.email },
    select: { id: true },
  });

  if (!user) {
    logResourceNotFound('user', maskEmail(reset.email), '/api/auth/reset-password/[token]', 'POST');
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  const hashedPassword = await hash(password, BCRYPT_SALT_ROUNDS);

  try {
    await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
      const consumed = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (consumed.count === 0) {
        throw new ResetTokenAlreadyUsedError();
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordUpdatedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof ResetTokenAlreadyUsedError) {
      logResourceNotFound('password_reset', maskToken(token), '/api/auth/reset-password/[token]', 'POST', {
        reason: 'already_used',
      });
      return NextResponse.json({ error: "Der Link ist abgelaufen" }, { status: 410 });
    }
    throw error;
  }

  await recordSuccessfulTokenUsageWithPolicy(
    "/api/auth/reset-password/[token]",
    "POST",
    tokenHash,
    clientIp,
    maskToken(token)
  );

  logInfo('password_reset_completed', 'Password reset completed', {
    email: reset.email,
  });

  return NextResponse.json({
    message: "Passwort wurde erfolgreich geändert",
  });
}, { route: "/api/auth/reset-password/[token]", method: "POST" });

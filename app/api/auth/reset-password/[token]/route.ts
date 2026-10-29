import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNoCacheHeaders } from "@/lib/api-error-handler";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { recordSuccessfulTokenUsageWithPolicy, withTokenRateLimit } from "@/lib/api-utils";
import { hash } from "bcryptjs";
import { validatePassword } from "@/lib/password-validation";
import { hashResetToken } from "@/lib/password-reset";
import { logInfo, logValidationFailure, logResourceNotFound, maskToken, maskEmail } from "@/lib/logger";

const ROUTE = "/api/auth/reset-password/[token]";

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

export const GET = withTokenRateLimit({
  route: ROUTE,
  method: "GET",
  action: "password_reset_rate_limited",
  hashToken: hashResetToken,
  kind: "read",
  invalidTokenMessage: "Ungültiger Link",
  invalidTokenNoCache: true,
}, async (_request: NextRequest, { token }) => {
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
});

export const POST = withTokenRateLimit({
  route: ROUTE,
  method: "POST",
  action: "password_reset_rate_limited",
  hashToken: hashResetToken,
  requireCsrf: true,
  invalidTokenMessage: "Ungültiger Link",
}, async (request: NextRequest, { token, tokenHash, clientIp }) => {
  const body = await parseAndValidateBody<ResetPasswordRequest>(request, resetPasswordSchema, { route: ROUTE, method: 'POST' });

  const password = typeof body.password === "string" ? body.password : "";

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    logValidationFailure(ROUTE, 'POST', passwordValidation.errors, { token: maskToken(token) });
    throw new ValidationError(passwordValidation.errors);
  }

  const { reset, status } = await findValidResetToken(token);
  if (!reset) {
    const message = status === 410 ? "Der Link ist abgelaufen" : "Ungültiger Link";
    logResourceNotFound('password_reset', maskToken(token), ROUTE, 'POST', {
      reason: status === 410 ? 'expired' : 'invalid',
    });
    return NextResponse.json({ error: message }, { status });
  }

  const user = await prisma.user.findUnique({
    where: { email: reset.email },
    select: { id: true },
  });

  if (!user) {
    logResourceNotFound('user', maskEmail(reset.email), ROUTE, 'POST');
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  const hashedPassword = await hash(password, BCRYPT_SALT_ROUNDS);

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      logResourceNotFound('password_reset', maskToken(token), ROUTE, 'POST', {
        reason: 'already_used',
      });
      return NextResponse.json({ error: "Der Link ist abgelaufen" }, { status: 410 });
    }
    throw error;
  }

  await recordSuccessfulTokenUsageWithPolicy(
    ROUTE,
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
});

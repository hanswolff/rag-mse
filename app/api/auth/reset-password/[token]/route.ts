import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, handleRateLimitBlocked, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { hash } from "bcryptjs";
import { validatePassword } from "@/lib/password-validation";
import { hashResetToken } from "@/lib/password-reset";
import { logInfo, logValidationFailure, logResourceNotFound, maskToken, logWarn } from "@/lib/logger";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";

const BCRYPT_SALT_ROUNDS = 10;

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
    }

    const { reset, status } = await findValidResetToken(token);
    if (!reset) {
      const message = status === 410 ? "Der Link ist abgelaufen" : "Ungültiger Link";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      email: reset.email,
      expiresAt: reset.expiresAt,
    });
  } catch (error) {
    logApiError(error, {
      route: "/api/auth/reset-password/[token]",
      method: "GET",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    validateCsrfHeaders(request);

    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const tokenHash = hashResetToken(token);
    let rateLimitResult = { allowed: true, attemptCount: 0 } as {
      allowed: boolean;
      blockedUntil?: number;
      attemptCount: number;
    };
    try {
      rateLimitResult = await checkTokenRateLimit(clientIp, tokenHash);
    } catch (rateLimitError) {
      logWarn('password_reset_rate_limit_unavailable', 'Rate limiter unavailable for password reset route, continuing without enforcement', {
        route: "/api/auth/reset-password/[token]",
        method: "POST",
        clientIp,
        token: maskToken(token),
        error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
      });
    }

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

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, resetPasswordSchema, { route: '/api/auth/reset-password/[token]', method: 'POST' });
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
      logResourceNotFound('user', reset.email, '/api/auth/reset-password/[token]', 'POST');
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    const hashedPassword = await hash(password, BCRYPT_SALT_ROUNDS);

    await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordUpdatedAt: new Date(),
        },
      });

      await tx.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });
    });

    try {
      await recordSuccessfulTokenUsage(tokenHash, clientIp);
    } catch (rateLimitError) {
      logWarn('password_reset_rate_limit_cleanup_failed', 'Failed to clear token rate limit state after successful password reset', {
        route: "/api/auth/reset-password/[token]",
        method: "POST",
        clientIp,
        token: maskToken(token),
        error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
      });
    }

    logInfo('password_reset_completed', 'Password reset completed', {
      email: reset.email,
    });

    return NextResponse.json({
      message: "Passwort wurde erfolgreich geändert",
    });
  } catch (error: unknown) {
    logApiError(error, {
      route: "/api/auth/reset-password/[token]",
      method: "POST",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

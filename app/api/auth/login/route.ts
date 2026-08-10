import { NextRequest, NextResponse } from "next/server";
import { authorizeCredentials, createLoginProof } from "@/lib/auth";
import { logError, logValidationFailure, maskEmail } from "@/lib/logger";
import { parseJsonBody, validateRequestBody, validateCsrfHeaders, getClientIp, withApiErrorHandling } from "@/lib/api-utils";
import { validateEmail } from "@/lib/validation-schema";
import { pluralize } from "@/lib/pluralization";
import { RateLimitError, RateLimitUnavailableError } from "@/lib/errors";

interface LoginRequest {
  email: string;
  password: string;
}

const loginSchema = {
  email: { type: 'string' as const },
  password: { type: 'string' as const },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const body = await parseJsonBody<LoginRequest>(request);

  const bodyValidation = validateRequestBody(body, loginSchema, { route: '/api/auth/login', method: 'POST' });
  if (!bodyValidation.isValid) {
    return NextResponse.json(
      { error: bodyValidation.errors.join(". ") },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    logValidationFailure('/api/auth/login', 'POST', 'E-Mail und Passwort sind erforderlich', {
      route: '/api/auth/login',
    });
    return NextResponse.json(
      { error: "E-Mail und Passwort sind erforderlich" },
      { status: 400 }
    );
  }

  if (!validateEmail(email)) {
    logValidationFailure('/api/auth/login', 'POST', 'Bitte geben Sie eine gültige E-Mail-Adresse ein', {
      route: '/api/auth/login',
    });
    return NextResponse.json(
      { error: "Bitte geben Sie eine gültige E-Mail-Adresse ein" },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await authorizeCredentials({ email, password }, request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      const minutes = error.blockedMinutes;
      const minuteLabel = pluralize(minutes, "Minute", "Minuten");
      return NextResponse.json(
        { error: `Zu viele fehlgeschlagene Login-Versuche. Bitte versuchen Sie es in ${minutes} ${minuteLabel} erneut.` },
        { status: 429 }
      );
    }
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { error: "Login ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut." },
        { status: 503 }
      );
    }
    throw error;
  }

  if (!user) {
    logError('login_failed', 'Login attempt failed: invalid credentials', {
      email: maskEmail(email),
    });

    return NextResponse.json(
      { error: "Ungültige E-Mail oder Passwort" },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(
      {
        success: true,
        loginProof: createLoginProof(email, getClientIp(request), password),
      },
      { status: 200 }
    );
  } catch (proofError) {
    logError("login_proof_error", "Failed to create login proof", {
      error: proofError instanceof Error ? proofError.message : String(proofError),
    });
    return NextResponse.json(
      { error: "Login ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut." },
      { status: 503 }
    );
  }
}, { route: "/api/auth/login", method: "POST" });

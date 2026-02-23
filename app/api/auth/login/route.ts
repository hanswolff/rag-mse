import { NextRequest, NextResponse } from "next/server";
import { authorizeCredentials, createLoginProof } from "@/lib/auth";
import { logError, logValidationFailure, maskEmail } from "@/lib/logger";
import { parseJsonBody, BadRequestError, validateRequestBody, validateCsrfHeaders, getClientIp } from "@/lib/api-utils";
import { withCorrelationId } from "@/lib/api-middleware";
import { validateEmail } from "@/lib/validation-schema";

interface LoginRequest {
  email: string;
  password: string;
}

const loginSchema = {
  email: { type: 'string' as const },
  password: { type: 'string' as const },
} as const;

async function handleLogin(request: NextRequest): Promise<NextResponse> {
  try {
    validateCsrfHeaders(request);

    const body = await parseJsonBody<LoginRequest>(request);

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, loginSchema, { route: '/api/auth/login', method: 'POST' });
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.startsWith("RATE_LIMITED:")) {
        if (errorMessage === "RATE_LIMIT_UNAVAILABLE") {
          return NextResponse.json(
            { error: "Anmeldung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut." },
            { status: 503 }
          );
        }
        throw error;
      }
      const minutes = errorMessage.split(":")[1] || "1";
      return NextResponse.json(
        { error: `Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuchen Sie es in ${minutes} Minute(n) erneut.` },
        { status: 429 }
      );
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
        { error: "Anmeldung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut." },
        { status: 503 }
      );
    }
  } catch (error) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError('login_error', 'Unexpected error during login', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
      { status: 500 }
    );
  }
}

export const POST = withCorrelationId(handleLogin);

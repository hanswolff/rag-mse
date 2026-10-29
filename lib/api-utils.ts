import { NextRequest, NextResponse } from "next/server";
import { logError, logWarn, maskToken } from "@/lib/logger";
import { getClientIdentifier } from "./proxy-trust";
import { pluralize } from "./pluralization";
import { checkTokenRateLimit, checkTokenReadRateLimit, recordSuccessfulTokenUsage } from "./rate-limiter";
import { shouldFailOpenOnRateLimiterError } from "./rate-limit-policy";
import { TokenRateLimitUnavailableError } from "./errors";
import { validateCsrfHeaders } from "./csrf-validator";
import { getNoCacheHeaders, withApiErrorHandling } from "./api-error-handler";

export function getClientIp(request: NextRequest): string {
  return getClientIdentifier(request);
}

export function handleRateLimitBlocked(
  action: string,
  route: string,
  tokenHash: string,
  clientIp: string,
  blockedUntil: number | undefined,
  attemptCount: number
): NextResponse {
  logWarn(action, 'Rate limit exceeded', {
    clientIp,
    tokenHash: maskToken(tokenHash),
    attemptCount,
    blockedUntil,
  });

  if (blockedUntil) {
    const blockedMinutes = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000));
    const minuteLabel = pluralize(blockedMinutes, "Minute", "Minuten");
    return NextResponse.json(
      {
        error: `Zu viele fehlgeschlagene Versuche. Bitte versuchen Sie es in ${blockedMinutes} ${minuteLabel} erneut.`
      },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." },
    { status: 429 }
  );
}

export type RateLimitCheckResult = {
  allowed: boolean;
  blockedUntil?: number;
  attemptCount: number;
};

// Fail-open-Muster der IP-basierten Limiter (Kontakt, Geocode, Passwort
// vergessen): Limiter-Ausfall blockiert je nach Policy mit 503 oder lässt die
// Anfrage mit Log-Warnung durch.
export async function checkRateLimitWithPolicy(
  checkFn: () => Promise<RateLimitCheckResult>,
  context: {
    // Log-Action für den Ausfall, z. B. "rate_limit_unavailable"
    unavailableAction: string;
    // Routenname im Log-Text, z. B. "contact" → "... unavailable for contact route ..."
    routeLabel: string;
    failClosedLogLevel?: "error" | "warn";
    logContext: Record<string, unknown>;
  }
): Promise<RateLimitCheckResult | NextResponse> {
  try {
    return await checkFn();
  } catch (rateLimitError) {
    const errorContext = {
      ...context.logContext,
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    };

    if (!shouldFailOpenOnRateLimiterError()) {
      const logBlocked = context.failClosedLogLevel === "warn" ? logWarn : logError;
      logBlocked(
        context.unavailableAction,
        `Rate limiter unavailable for ${context.routeLabel} route, blocking request`,
        errorContext
      );
      return NextResponse.json(
        { error: "Dienst aktuell nicht verfügbar. Bitte später erneut versuchen." },
        { status: 503 }
      );
    }

    logWarn(
      context.unavailableAction,
      `Rate limiter unavailable for ${context.routeLabel} route, continuing due to fail-open policy`,
      errorContext
    );

    return { allowed: true, attemptCount: 0 };
  }
}

export async function checkTokenRateLimitWithPolicy(
  route: string,
  method: string,
  clientIp: string,
  tokenHash: string,
  maskedToken: string,
  // "read" für reine Status-Lookups (GET): eigenes, großzügigeres Budget,
  // damit Seitenaufrufe nicht die wenigen Einlöseversuche verbrauchen
  kind: "attempt" | "read" = "attempt"
): Promise<{ allowed: boolean; blockedUntil?: number; attemptCount: number }> {
  try {
    return kind === "read"
      ? await checkTokenReadRateLimit(clientIp, tokenHash)
      : await checkTokenRateLimit(clientIp, tokenHash);
  } catch (rateLimitError) {
    if (!shouldFailOpenOnRateLimiterError()) {
      logError("token_rate_limit_unavailable", "Rate limiter unavailable for token-based route, blocking request", {
        route,
        method,
        clientIp,
        token: maskedToken,
        error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
      });
      throw new TokenRateLimitUnavailableError();
    }

    logWarn("token_rate_limit_unavailable", "Rate limiter unavailable for token-based route, continuing due to fail-open policy", {
      route,
      method,
      clientIp,
      token: maskedToken,
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    });

    return { allowed: true, attemptCount: 0 };
  }
}

export type TokenRateLimitOptions = {
  route: string;
  method: string;
  // Log-Action für den Rate-Limit-Treffer, z. B. "invitation_rate_limited"
  action: string;
  hashToken: (token: string) => string;
  kind?: "attempt" | "read";
  // POST-Routen validieren CSRF vor allen Token-Prüfungen
  requireCsrf?: boolean;
  invalidTokenMessage: string;
  // GET-Status-Routen liefern die 400-Antwort mit No-Cache-Headern aus
  invalidTokenNoCache?: boolean;
};

export type TokenRequestContext = {
  token: string;
  tokenHash: string;
  clientIp: string;
};

// Gemeinsame Präambel aller Token-Routen (Einladung, Passwort-Reset, RSVP,
// Abmelden): Token lesen, CSRF (bei POST), Rate-Limit prüfen und den geprüften
// Kontext an den Handler geben. handleRateLimitBlocked erhält konsistent den
// Token-HASH (nie den Rohtoken).
export function withTokenRateLimit(
  options: TokenRateLimitOptions,
  handler: (request: NextRequest, tokenContext: TokenRequestContext) => Promise<NextResponse>
): (request: NextRequest, ctx: { params: Promise<{ token: string }> }) => Promise<NextResponse> {
  return withApiErrorHandling(async (request: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
    if (options.requireCsrf) {
      validateCsrfHeaders(request);
    }

    const { token } = await ctx.params;
    if (!token) {
      return NextResponse.json(
        { error: options.invalidTokenMessage },
        { status: 400, headers: options.invalidTokenNoCache ? getNoCacheHeaders() : undefined }
      );
    }

    const clientIp = getClientIp(request);
    const tokenHash = options.hashToken(token);
    const rateLimitResult = await checkTokenRateLimitWithPolicy(
      options.route,
      options.method,
      clientIp,
      tokenHash,
      maskToken(token),
      options.kind ?? "attempt"
    );

    if (!rateLimitResult.allowed) {
      return handleRateLimitBlocked(
        options.action,
        options.route,
        tokenHash,
        clientIp,
        rateLimitResult.blockedUntil,
        rateLimitResult.attemptCount
      );
    }

    return handler(request, { token, tokenHash, clientIp });
  }, { route: options.route, method: options.method });
}

export async function recordSuccessfulTokenUsageWithPolicy(
  route: string,
  method: string,
  tokenHash: string,
  clientIp: string,
  maskedToken: string
): Promise<void> {
  try {
    await recordSuccessfulTokenUsage(tokenHash, clientIp);
  } catch (rateLimitError) {
    logWarn("token_rate_limit_cleanup_failed", "Failed to clear token rate limit state after successful token usage", {
      route,
      method,
      clientIp,
      token: maskedToken,
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    });
  }
}

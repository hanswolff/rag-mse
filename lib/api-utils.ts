import { NextRequest, NextResponse } from "next/server";
import { logError, logWarn, maskToken } from "@/lib/logger";
import { getClientIdentifier } from "./proxy-trust";
import { pluralize } from "./pluralization";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "./rate-limiter";
import { shouldFailOpenOnRateLimiterError } from "./rate-limit-policy";
import { TokenRateLimitUnavailableError } from "./errors";

export { CsrfError, validateCsrfHeaders } from "./csrf-validator";
export {
  MAX_REQUEST_BODY_SIZE,
  getMaxSizeMB,
  BadRequestError,
  PayloadTooLargeError,
  parseJsonBody,
  validateRequestBody,
  type FieldValidator,
  type FieldDefinition,
  type BodySchema,
} from "./request-body-parser";
export {
  logApiError,
  logAccessDenied,
  getNoCacheHeaders,
  getPublicCacheHeaders,
  getAuthNoCacheHeaders,
  withApiErrorHandling,
  registerErrorHandler,
} from "./api-error-handler";

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
    const blockedMinutes = Math.ceil((blockedUntil - Date.now()) / 60000);
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

export async function checkTokenRateLimitWithPolicy(
  route: string,
  method: string,
  clientIp: string,
  tokenHash: string,
  maskedToken: string
): Promise<{ allowed: boolean; blockedUntil?: number; attemptCount: number }> {
  try {
    return await checkTokenRateLimit(clientIp, tokenHash);
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

    logWarn("token_rate_limit_unavailable", "Rate limiter unavailable for token-based route, continuing due fail-open policy", {
      route,
      method,
      clientIp,
      token: maskedToken,
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    });

    return { allowed: true, attemptCount: 0 };
  }
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

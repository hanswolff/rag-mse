import { NextRequest, NextResponse } from "next/server";
import { logError, logWarn, maskToken, logValidationFailure } from "@/lib/logger";
import { addCorrelationIdHeaders } from "@/lib/api-middleware";
import { getClientIdentifier } from "./proxy-trust";
import { getCorrelationId, withNewCorrelationId } from "./correlation-id";

const DEFAULT_MAX_REQUEST_BODY_SIZE = 1048576;
export const MAX_REQUEST_BODY_SIZE = parseInt(process.env.MAX_REQUEST_BODY_SIZE || `${DEFAULT_MAX_REQUEST_BODY_SIZE}`, 10);

export function getMaxSizeMB(maxBytes = MAX_REQUEST_BODY_SIZE): string {
  return (maxBytes / 1024 / 1024).toFixed(1);
}

export class BadRequestError extends Error {
  constructor(message = "Ungültige Anfrage") {
    super(message);
    this.name = "BadRequestError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor(message = "Request body zu groß") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export class CsrfError extends Error {
  constructor(message = "Ungültiger Origin oder Referer Header. Bitte versuchen Sie es erneut.") {
    super(message);
    this.name = "CsrfError";
  }
}

type ApiErrorContext = {
  route?: string;
  method?: string;
  status?: number;
  message?: string;
  userId?: string;
  userEmail?: string;
  resourceId?: string;
  name?: string;
  [key: string]: unknown;
};

export function logApiError(error: unknown, context: ApiErrorContext = {}) {
  if (error instanceof Error) {
    const isProduction = process.env.NODE_ENV === 'production';
    const errorContext: ApiErrorContext = {
      ...context,
      name: error.name,
      message: error.message,
    };

    if (!isProduction) {
      errorContext.stack = error.stack;
    }

    logError('api_error', `API error in ${context.route || 'unknown'}`, errorContext);
    return;
  }

  logError('api_error', `API error in ${context.route || 'unknown'}`, { ...context, error });
}

export function logAccessDenied(route: string, method: string, reason: string, context: Omit<ApiErrorContext, 'route' | 'method'> = {}) {
  logWarn('access_denied', `Access denied for ${route}`, {
    route,
    method,
    reason,
    ...context,
  });
}

export async function parseJsonBody<T>(request: Request, maxBodySize = MAX_REQUEST_BODY_SIZE): Promise<T> {
  const headers = (request as NextRequest)?.headers || request.headers;
  const contentLength = headers?.get("content-length");
  const maxSizeMB = getMaxSizeMB(maxBodySize);

  if (contentLength) {
    const contentLengthNum = parseInt(contentLength, 10);
    if (contentLengthNum > maxBodySize) {
      throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
    }
  }

  try {
    const requestWithClone = request as Request & { clone?: () => Request };
    if (typeof requestWithClone.clone === "function") {
      const requestToRead = requestWithClone.clone();
      let bodyText = "";

      if (requestToRead.body && typeof requestToRead.body.getReader === "function") {
        const reader = requestToRead.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = value ?? new Uint8Array();
          totalBytes += chunk.byteLength;
          if (totalBytes > maxBodySize) {
            await reader.cancel();
            throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
          }
          chunks.push(chunk);
        }

        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        bodyText = new TextDecoder().decode(merged);
      } else {
        bodyText = await requestToRead.text();
        const bodySize = new TextEncoder().encode(bodyText).length;
        if (bodySize > maxBodySize) {
          throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
        }
      }

      return JSON.parse(bodyText) as T;
    }

    const body = await request.json();
    const bodySize = new TextEncoder().encode(JSON.stringify(body)).length;
    if (bodySize > maxBodySize) {
      throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
    }

    return body as T;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      throw error;
    }
    throw new BadRequestError("Ungültiges JSON");
  }
}

export type FieldValidator = (value: unknown) => boolean;

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  optional?: boolean;
  validator?: FieldValidator;
}

export type BodySchema = Record<string, FieldDefinition>;

export function validateRequestBody(
  body: Record<string, unknown>,
  schema: BodySchema,
  context: { route: string; method: string }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedFields = new Set(Object.keys(schema));

  for (const [key, fieldDef] of Object.entries(schema)) {
    if (fieldDef.optional) continue;
    if (!(key in body)) {
      errors.push(`Pflichtfeld fehlt: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(body)) {
    if (!allowedFields.has(key)) {
      errors.push(`Unerwartetes Feld: ${key}`);
      continue;
    }

    const fieldDef = schema[key];

    if (value === undefined) {
      continue;
    }

    if (value === null) {
      errors.push(`Feld '${key}' darf nicht null sein`);
      continue;
    }

    const typeError = validateFieldType(key, value, fieldDef.type);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    if (fieldDef.validator && !fieldDef.validator(value)) {
      errors.push(`Ungültiger Wert für Feld '${key}'`);
    }
  }

  if (errors.length > 0) {
    logValidationFailure(context.route, context.method, errors.join("; "));
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateFieldType(key: string, value: unknown, expectedType: FieldDefinition['type']): string | null {
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (actualType === 'object' && value !== null && !Array.isArray(value)) {
    if (expectedType !== 'object') {
      return `Feld '${key}' muss vom Typ ${expectedType} sein, ist aber ein Objekt`;
    }
    return null;
  }

  if (actualType !== expectedType) {
    return `Feld '${key}' muss vom Typ ${expectedType} sein, ist aber ${actualType}`;
  }

  return null;
}

export function getClientIp(request: NextRequest): string {
  return getClientIdentifier(request);
}

export function validateCsrfHeaders(request: NextRequest): void {
  const method = (request.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  const appUrl = process.env.APP_URL;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!appUrl) {
    return;
  }

  let appUrlObj: URL;
  try {
    appUrlObj = new URL(appUrl);
  } catch {
    return;
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isLikelyBrowser = userAgent.includes("Mozilla") ||
    userAgent.includes("Chrome") ||
    userAgent.includes("Safari") ||
    userAgent.includes("Firefox") ||
    userAgent.includes("Edge");

  if (!isLikelyBrowser) {
    return;
  }

  const validateHeader = (header: string | null): boolean => {
    if (!header) return false;
    try {
      const headerUrl = new URL(header);
      return headerUrl.origin === appUrlObj.origin;
    } catch {
      return false;
    }
  };

  const isOriginValid = validateHeader(origin);
  const isRefererValid = validateHeader(referer);

  if (!isOriginValid && !isRefererValid) {
    throw new CsrfError("Ungültiger Origin oder Referer Header. Bitte versuchen Sie es erneut.");
  }
}

export function getNoCacheHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

export function getAuthNoCacheHeaders() {
  return {
    ...getNoCacheHeaders(),
    "Vary": "Authorization, Cookie",
  };
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
    return NextResponse.json(
      {
        error: `Zu viele fehlgeschlagene Versuche. Bitte versuchen Sie es in ${blockedMinutes} Minute(n) erneut.`
      },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." },
    { status: 429 }
  );
}

type ApiHandler<T = unknown, Args extends unknown[] = unknown[]> = (...args: Args) => Promise<T> | T;

type RouteInfo = {
  route: string;
  method: string;
};

export function withApiErrorHandling<T, Args extends unknown[] = unknown[]>(
  handler: ApiHandler<T, Args>,
  routeInfo: RouteInfo
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    const execute = async () => {
      try {
        const result = await handler(...args);
        const response = result as NextResponse;
        return addCorrelationIdHeaders(response);
      } catch (error: unknown) {
        return handleApiError(error, routeInfo);
      }
    };

    if (getCorrelationId()) {
      return execute();
    }

    return withNewCorrelationId(execute);
  };
}

function handleApiError(error: unknown, routeInfo: RouteInfo): NextResponse {
  let response: NextResponse;

  if (error instanceof BadRequestError) {
    response = NextResponse.json({ error: error.message }, { status: 400 });
  } else if (error instanceof PayloadTooLargeError) {
    response = NextResponse.json({ error: error.message }, { status: 413 });
  } else if (error instanceof CsrfError) {
    logAccessDenied(routeInfo.route, routeInfo.method, 'CSRF validation failed', {
      name: error.name,
      message: error.message,
    });
    response = NextResponse.json({ error: error.message }, { status: 403 });
  } else if (error instanceof Error && error.name === "UnauthorizedError") {
    logAccessDenied(routeInfo.route, routeInfo.method, 'Unauthorized', {
      name: error.name,
      message: error.message,
    });
    response = NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  } else if (error instanceof Error && error.name === "ForbiddenError") {
    logAccessDenied(routeInfo.route, routeInfo.method, 'Forbidden', {
      name: error.name,
      message: error.message,
    });
    response = NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  } else {
    logApiError(error, {
      route: routeInfo.route,
      method: routeInfo.method,
      status: 500,
    });
    response = NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 });
  }

  return addCorrelationIdHeaders(response);
}

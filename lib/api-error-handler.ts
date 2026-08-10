import { NextResponse } from "next/server";
import { logError, logWarn } from "@/lib/logger";
import { addCorrelationIdHeaders } from "@/lib/api-middleware";
import { getCorrelationId, withNewCorrelationId } from "./correlation-id";
import { TokenRateLimitUnavailableError } from "./errors";
import { BadRequestError, PayloadTooLargeError } from "./request-body-parser";
import { CsrfError } from "./csrf-validator";

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

export function getNoCacheHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

export function getPublicCacheHeaders(maxAgeSeconds = 60, sMaxAgeSeconds = 300) {
  return {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${sMaxAgeSeconds}`,
    // Dieselbe URL liefert eingeloggt eine andere Antwort (z.B. eigene
    // Teilnahmeanmeldung): Caches müssen nach Cookie unterscheiden, sonst
    // wird Mitgliedern nach dem Login die anonyme Variante serviert.
    "Vary": "Cookie",
  };
}

export function getAuthNoCacheHeaders() {
  return {
    ...getNoCacheHeaders(),
    "Vary": "Authorization, Cookie",
  };
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

type ErrorHandler = (error: Error, routeInfo: RouteInfo) => NextResponse | null;

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: getNoCacheHeaders() });
}

const errorHandlers: ErrorHandler[] = [
  (error, _routeInfo) => {
    if (error instanceof BadRequestError) {
      return errorResponse(error.message, 400);
    }
    return null;
  },
  (error, _routeInfo) => {
    if (error instanceof PayloadTooLargeError) {
      return errorResponse(error.message, 413);
    }
    return null;
  },
  (error, routeInfo) => {
    if (error instanceof CsrfError) {
      logAccessDenied(routeInfo.route, routeInfo.method, 'CSRF validation failed', {
        name: error.name,
        message: error.message,
      });
      return errorResponse(error.message, 403);
    }
    return null;
  },
  (error, routeInfo) => {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      logAccessDenied(routeInfo.route, routeInfo.method, 'Unauthorized', {
        name: error.name,
        message: error.message,
      });
      return errorResponse("Nicht autorisiert", 401);
    }
    return null;
  },
  (error, routeInfo) => {
    if (error instanceof Error && error.name === "ForbiddenError") {
      logAccessDenied(routeInfo.route, routeInfo.method, 'Forbidden', {
        name: error.name,
        message: error.message,
      });
      return errorResponse("Keine Berechtigung", 403);
    }
    return null;
  },
  (error, _routeInfo) => {
    if (error instanceof TokenRateLimitUnavailableError) {
      return errorResponse("Dienst aktuell nicht verfügbar. Bitte später erneut versuchen.", 503);
    }
    return null;
  },
];

export function registerErrorHandler(handler: ErrorHandler): void {
  errorHandlers.unshift(handler);
}

function handleApiError(error: unknown, routeInfo: RouteInfo): NextResponse {
  if (error instanceof Error) {
    for (const handler of errorHandlers) {
      const response = handler(error, routeInfo);
      if (response) {
        return addCorrelationIdHeaders(response);
      }
    }
  }

  logApiError(error, {
    route: routeInfo.route,
    method: routeInfo.method,
    status: 500,
  });
  return addCorrelationIdHeaders(errorResponse("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", 500));
}

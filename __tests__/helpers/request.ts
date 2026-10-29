import { NextRequest } from "next/server";

const BASE_URL = "http://localhost:3000";

/**
 * Unit-Pendant zu __tests__/integration/helpers/api.ts: baut Requests über den
 * NextRequest aus jest.setup.js. `browser: true` setzt Origin + User-Agent, so
 * dass der echte CSRF-Check aus lib/csrf-validator.ts tatsächlich durchlaufen
 * wird (ohne User-Agent steigt er vorher aus).
 */
export const BROWSER_HEADERS = {
  origin: BASE_URL,
  "user-agent": "Mozilla/5.0 (jest unit test)",
} as const;

interface ApiRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  browser?: boolean;
}

export function apiRequest(
  method: string,
  path: string,
  options: ApiRequestOptions = {},
): NextRequest {
  const { body, headers, browser } = options;
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: {
      "content-type": "application/json",
      ...(browser ? BROWSER_HEADERS : {}),
      ...headers,
    },
  });
}

// App-Router übergibt Routen-Parameter als Promise (Next 15+).
export function routeContext<T extends Record<string, string>>(
  params: T,
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

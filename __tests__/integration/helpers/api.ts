import { NextRequest } from "next/server";

const BASE_URL = "http://localhost:3000";

interface ApiRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

// Echte NextRequest-Instanzen (kein Mock aus jest.setup.js): die Handler laufen
// gegen dieselben Request-/Response-Klassen wie in der gebauten App.
export function apiRequest(
  method: string,
  path: string,
  options: ApiRequestOptions = {}
): NextRequest {
  const { body, headers } = options;
  return new NextRequest(`${BASE_URL}${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json", ...headers },
  });
}

// App-Router übergibt Routen-Parameter als Promise (Next 15+). Bewusst ohne
// Cast: ein falscher Params-Shape soll schon im Typecheck auffallen.
export function routeContext<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

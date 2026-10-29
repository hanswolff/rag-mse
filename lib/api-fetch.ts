import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { FieldError } from "@/lib/server-error-mapper";

export const GENERIC_API_ERROR_MESSAGE = "Ein Fehler ist aufgetreten";
export const NETWORK_ERROR_MESSAGE = "Netzwerkfehler: Der Server ist nicht erreichbar. Bitte versuchen Sie es erneut.";
export const DEFAULT_API_TIMEOUT_MS = 30_000;

// fetch wirft bei Netzwerkfehlern TypeError mit englischer Browser-Meldung ("Failed to fetch")
export function toDisplayErrorMessage(err: unknown, fallback: string = GENERIC_API_ERROR_MESSAGE): string {
  if (err instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  if (err instanceof SyntaxError) return fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Fehler einer nicht-erfolgreichen API-Antwort. `message` ist die Servermeldung
 * (`data.error`), sonst der deutsche Fallback-Text des Aufrufers.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Rohe Servermeldung (`data.error`), falls vorhanden. */
  readonly serverMessage?: string;
  readonly fieldErrors?: FieldError[];
  readonly data: unknown;

  constructor(options: {
    status: number;
    serverMessage?: string;
    fallback: string;
    fieldErrors?: FieldError[];
    data: unknown;
  }) {
    super(options.serverMessage || options.fallback);
    this.name = "ApiError";
    this.status = options.status;
    this.serverMessage = options.serverMessage;
    this.fieldErrors = options.fieldErrors;
    this.data = options.data;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body" | "headers"> {
  /** Plain-Objekte werden als JSON gesendet; FormData/String unverändert. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Aktiviert einen Abbruch via AbortController nach Ablauf der Frist. */
  timeoutMs?: number;
  /** Deutscher Fallback-Text, wenn die Antwort kein `error`-Feld enthält. */
  fallbackError?: string;
}

// 204- oder Nicht-JSON-Antworten dürfen keinen JSON-Parse-Fehler auslösen
async function parseJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Gemeinsames fetch→json→throw-Muster der Client-Seiten: parst die Antwort als
 * JSON, wirft bei `!response.ok` einen `ApiError` mit `data.error` bzw. dem
 * deutschen Fallback-Text. Netzwerk- und Abbruchfehler werden unverändert
 * weitergereicht, damit Aufrufer sie wie bisher behandeln können.
 */
export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, headers, timeoutMs, fallbackError = GENERIC_API_ERROR_MESSAGE, ...init } = options;

  const isRawBody =
    typeof body === "string" ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
    (typeof Blob !== "undefined" && body instanceof Blob);

  const requestInit: RequestInit = {
    ...init,
    ...(body !== undefined && { body: isRawBody ? (body as BodyInit) : JSON.stringify(body) }),
    headers:
      body !== undefined && !isRawBody
        ? { "Content-Type": "application/json", ...headers }
        : headers,
  };

  const response =
    timeoutMs !== undefined
      ? await fetchWithTimeout(url, { ...requestInit, timeoutMs })
      : await fetch(url, requestInit);

  const data = await parseJsonBody(response);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      serverMessage: typeof data.error === "string" && data.error ? data.error : undefined,
      fallback: fallbackError,
      fieldErrors: data.fieldErrors as FieldError[] | undefined,
      data,
    });
  }

  return data as T;
}

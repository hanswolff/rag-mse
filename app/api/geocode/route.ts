import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-utils";
import { logWarn, logInfo } from "@/lib/logger";
import { getClientIdentifier } from "@/lib/proxy-trust";
import { checkGeocodeRateLimit } from "@/lib/rate-limiter";

const MIN_QUERY_LENGTH = 3;
const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const FETCH_TIMEOUT_MS = 10_000;

class GeocodeTimeoutError extends Error {
  constructor() {
    super("Zeitüberschreitung bei der Geocoding-Suche");
    this.name = "GeocodeTimeoutError";
  }
}

function getUserAgent(): string {
  const appUrl = process.env.APP_URL || "https://rag-mse.de";
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter((e) => e.length > 0) || [];
  const contactEmail = adminEmails[0] || "admin@rag-mse.de";
  return `RAG-MSE-Website (${appUrl}; ${contactEmail})`;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

interface GeocodeResponse {
  latitude: number;
  longitude: number;
  displayName: string;
}

function validateQuery(query: string | null): { isValid: boolean; error: string | null } {
  if (!query || query.trim().length === 0) {
    return { isValid: false, error: "Adresse ist erforderlich" };
  }
  if (query.trim().length < MIN_QUERY_LENGTH) {
    return { isValid: false, error: `Adresse muss mindestens ${MIN_QUERY_LENGTH} Zeichen haben` };
  }
  return { isValid: true, error: null };
}

async function fetchFromNominatim(query: string): Promise<NominatimResponse[]> {
  const encodedQuery = encodeURIComponent(query.trim());

  try {
    const response = await fetchWithTimeout(
      `${NOMINATIM_API_URL}?format=json&q=${encodedQuery}&limit=1`,
      { headers: { "User-Agent": getUserAgent() } }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof GeocodeTimeoutError) {
      logWarn('geocode_timeout', 'Geocoding request timed out', {
        query: query.trim(),
        timeout: FETCH_TIMEOUT_MS,
      });
      throw error;
    }

    throw error;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new GeocodeTimeoutError();
    }

    throw error;
  }
}

function transformNominatimResult(result: NominatimResponse): GeocodeResponse {
  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    displayName: result.display_name,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<GeocodeResponse | { error: string }>> {
  try {
    await requireAdmin();

    const clientId = getClientIdentifier(request);
    try {
      const rateLimitResult = await checkGeocodeRateLimit(clientId, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
      if (!rateLimitResult.allowed) {
        logWarn('rate_limit_exceeded', 'Geocode rate limit exceeded', {
          clientId,
          attemptCount: rateLimitResult.attemptCount,
          route: "/api/geocode",
          method: "GET",
        });
        return NextResponse.json({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }, { status: 429 });
      }
    } catch (rateLimitError) {
      logWarn('rate_limit_unavailable', 'Rate limiter unavailable for geocode route, continuing without enforcement', {
        clientId,
        route: "/api/geocode",
        method: "GET",
        error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
      });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    const validation = validateQuery(query);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error as string }, { status: 400 });
    }

    const data = await fetchFromNominatim(query!);

    if (!data || data.length === 0) {
      logInfo('geocode_no_results', 'No geocoding results found', {
        query: query!.trim(),
      });
      return NextResponse.json({ error: "Kein Ergebnis für diese Adresse gefunden" }, { status: 404 });
    }

    const result = transformNominatimResult(data[0]);
    logInfo('geocode_success', 'Geocoding successful', {
      query: query!.trim(),
      result: {
        latitude: result.latitude,
        longitude: result.longitude,
        displayName: result.displayName,
      },
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    if (error instanceof GeocodeTimeoutError) {
      return NextResponse.json({ error: error.message }, { status: 504 });
    }

    logApiError(error, {
      route: "/api/geocode",
      method: "GET",
      status: 500,
    });
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 });
  }
}

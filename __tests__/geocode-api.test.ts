import { GET } from "@/app/api/geocode/route";
import { NextRequest } from "next/server";
import { logWarn, logInfo } from "@/lib/logger";
import { resetRateLimitForTesting } from "@/lib/rate-limiter";
import * as rateLimiter from "@/lib/rate-limiter";

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn().mockResolvedValue(undefined),
}));

const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    TRUSTED_PROXY_IPS: "127.0.0.1",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

let uniqueCounter = 0;

function createMockRequest(url: string = "http://localhost:3000/api/geocode?q=Test%20Address", headers: Record<string, string> = {}, ip?: string) {
  uniqueCounter++;
  const clientIp = ip || `192.168.1.${uniqueCounter}`;
  const request = {
    url,
    ip: "127.0.0.1",
    headers: {
      get: jest.fn((name: string) => {
        if (name === "x-forwarded-for") return headers["x-forwarded-for"] || clientIp;
        if (name === "x-real-ip") return headers["x-real-ip"] || "127.0.0.1";
        return headers[name] || null;
      }),
    },
  } as unknown as NextRequest;
  return request;
}

describe("/api/geocode/route", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    uniqueCounter = 0;
    await resetRateLimitForTesting();
  });

  afterEach(async () => {
    await resetRateLimitForTesting();
  });

  it("returns geocoding result for valid address", async () => {
    const mockNominatimResponse = [
      {
        lat: "52.5200066",
        lon: "13.4049540",
        display_name: "Berlin, Deutschland",
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse,
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Berlin");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      latitude: 52.5200066,
      longitude: 13.4049540,
      displayName: "Berlin, Deutschland",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://nominatim.openstreetmap.org/search?format=json&q=Berlin&limit=1",
      expect.objectContaining({
        headers: { "User-Agent": expect.stringContaining("RAG-MSE-Website") },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("returns 404 when no results found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=InvalidAddress12345");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Kein Ergebnis für diese Adresse gefunden");
    expect(logInfo).toHaveBeenCalledWith('geocode_no_results', 'No geocoding results found', {
      query: "InvalidAddress12345",
    });
  });

  it("returns 400 for missing query parameter", async () => {
    const request = createMockRequest("http://localhost:3000/api/geocode");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Adresse ist erforderlich");
  });

  it("returns 400 for query shorter than minimum length", async () => {
    const request = createMockRequest("http://localhost:3000/api/geocode?q=ab");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Adresse muss mindestens 3 Zeichen haben");
  });

  it("returns 504 when request times out", async () => {
    const abortError = new Error("Request aborted");
    abortError.name = "AbortError";

    global.fetch = jest.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        reject(abortError);
      });
    });

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Berlin");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error).toBe("Zeitüberschreitung bei der Geocoding-Suche");
    expect(logWarn).toHaveBeenCalledWith('geocode_timeout', 'Geocoding request timed out', {
      query: "Berlin",
      timeout: 10_000,
    });
  });

  it("handles Nominatim API errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Berlin");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Ein Fehler ist aufgetreten");
  });

  it("handles network errors", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Berlin");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Ein Fehler ist aufgetreten");
  });

  it("continues when rate limiter backend is unavailable", async () => {
    const rateLimitSpy = jest.spyOn(rateLimiter, "checkGeocodeRateLimit").mockRejectedValueOnce(new Error("Redis unavailable"));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          lat: "52.5200066",
          lon: "13.4049540",
          display_name: "Berlin, Deutschland",
        },
      ],
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Berlin");
    const response = await GET(request);

    expect(response.status).toBe(200);
    rateLimitSpy.mockRestore();
  });

  it("enforces rate limiting", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          lat: "52.5200066",
          lon: "13.4049540",
          display_name: "Berlin, Deutschland",
        },
      ],
    } as Response);

    const ip = "192.168.100.1";
    const createRequest = () => createMockRequest("http://localhost:3000/api/geocode?q=Berlin", {}, ip);

    const responses = [];

    for (let i = 0; i < 11; i++) {
      const response = await GET(createRequest());
      responses.push(response);
    }

    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
    expect(responses[2].status).toBe(200);
    expect(responses[3].status).toBe(200);
    expect(responses[4].status).toBe(200);
    expect(responses[5].status).toBe(200);
    expect(responses[6].status).toBe(200);
    expect(responses[7].status).toBe(200);
    expect(responses[8].status).toBe(200);
    expect(responses[9].status).toBe(200);
    expect(responses[10].status).toBe(429);

    const rateLimitedResponse = await responses[10].json();
    expect(rateLimitedResponse.error).toBe("Zu viele Anfragen. Bitte später erneut versuchen.");
  });

  it("respects rate limit window", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          lat: "52.5200066",
          lon: "13.4049540",
          display_name: "Berlin, Deutschland",
        },
      ],
    } as Response);

    const ip = "192.168.101.1";
    const createRequest = () => createMockRequest("http://localhost:3000/api/geocode?q=Berlin", {}, ip);

    const responses = [];

    for (let i = 0; i < 10; i++) {
      const response = await GET(createRequest());
      responses.push(response);
    }

    expect(responses[9].status).toBe(200);

    await resetRateLimitForTesting();
    const responseAfterReset = await GET(createRequest());
    expect(responseAfterReset.status).toBe(200);
  });

  it("logs successful geocoding", async () => {
    const mockNominatimResponse = [
      {
        lat: "52.5200066",
        lon: "13.4049540",
        display_name: "Berlin, Deutschland",
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse,
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Berlin");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(logInfo).toHaveBeenCalledWith('geocode_success', 'Geocoding successful', {
      query: "Berlin",
      result: {
        latitude: 52.5200066,
        longitude: 13.4049540,
        displayName: "Berlin, Deutschland",
      },
    });
  });

  it("logs rate limit exceeded", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          lat: "52.5200066",
          lon: "13.4049540",
          display_name: "Berlin, Deutschland",
        },
      ],
    } as Response);

    const ip = "192.168.102.1";
    const createRequest = () => createMockRequest("http://localhost:3000/api/geocode?q=Berlin", {}, ip);

    for (let i = 0; i < 10; i++) {
      await GET(createRequest());
    }

    const rateLimitedResponse = await GET(createRequest());
    expect(rateLimitedResponse.status).toBe(429);
    expect(logWarn).toHaveBeenCalledWith('rate_limit_exceeded', 'Geocode rate limit exceeded', expect.objectContaining({
      route: "/api/geocode",
      method: "GET",
    }));
  });

  it("trims whitespace from query", async () => {
    const mockNominatimResponse = [
      {
        lat: "52.5200066",
        lon: "13.4049540",
        display_name: "Berlin, Deutschland",
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse,
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=  Berlin  ");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://nominatim.openstreetmap.org/search?format=json&q=Berlin&limit=1",
      expect.any(Object)
    );
  });

  it("handles special characters in query", async () => {
    const mockNominatimResponse = [
      {
        lat: "48.8566140",
        lon: "2.3522219",
        display_name: "Paris, Frankreich",
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse,
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/geocode?q=Müllerstraße%2010");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

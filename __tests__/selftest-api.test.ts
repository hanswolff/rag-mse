jest.mock("@/lib/selftest/runner", () => ({
  runSelfTest: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/selftest/route";
import { runSelfTest } from "@/lib/selftest/runner";

const mockRunSelfTest = runSelfTest as jest.Mock;

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/selftest", { headers });
}

function okReport(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    durationMs: 5,
    checks: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe("/api/selftest", () => {
  const originalToken = process.env.SELFTEST_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SELFTEST_TOKEN = "secret-token";
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.SELFTEST_TOKEN;
    } else {
      process.env.SELFTEST_TOKEN = originalToken;
    }
  });

  it("returns 503 when no SELFTEST_TOKEN is configured", async () => {
    delete process.env.SELFTEST_TOKEN;

    const response = await GET(buildRequest({ authorization: "Bearer secret-token" }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe("self-test not configured");
    expect(mockRunSelfTest).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is missing", async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockRunSelfTest).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is wrong", async () => {
    const response = await GET(buildRequest({ authorization: "Bearer wrong-token" }));

    expect(response.status).toBe(401);
    expect(mockRunSelfTest).not.toHaveBeenCalled();
  });

  it("returns 200 and the report when everything is ok", async () => {
    mockRunSelfTest.mockResolvedValue(okReport());

    const response = await GET(buildRequest({ authorization: "Bearer secret-token" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
  });

  it("returns 200 with status warn when only warnings are present", async () => {
    mockRunSelfTest.mockResolvedValue(
      okReport({ status: "warn", warnings: [{ component: "Stammdaten", message: "Keine Schießstände" }] })
    );

    const response = await GET(buildRequest({ authorization: "Bearer secret-token" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("warn");
    expect(payload.warnings[0].component).toBe("Stammdaten");
  });

  it("returns 503 with status error and the failing component", async () => {
    mockRunSelfTest.mockResolvedValue(
      okReport({ status: "error", errors: [{ component: "Datenbank", message: "db down" }] })
    );

    const response = await GET(buildRequest({ authorization: "Bearer secret-token" }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("error");
    expect(payload.errors[0].component).toBe("Datenbank");
  });

  it("returns 500 when the runner itself throws", async () => {
    mockRunSelfTest.mockRejectedValue(new Error("boom"));

    const response = await GET(buildRequest({ authorization: "Bearer secret-token" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.status).toBe("error");
  });
});

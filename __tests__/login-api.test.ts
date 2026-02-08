import { POST } from "@/app/api/auth/login/route";
import { NextRequest } from "next/server";
import { logError } from "@/lib/logger";
import { authorizeCredentials } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  authorizeCredentials: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logError: jest.fn(),
  logValidationFailure: jest.fn(),
  maskEmail: jest.fn((email: string) => `masked-${email}`),
}));

jest.mock("@/lib/api-utils", () => ({
  parseJsonBody: jest.fn(async (req) => req.json()),
  BadRequestError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BadRequestError";
    }
  },
  validateRequestBody: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  validateCsrfHeaders: jest.fn(),
}));

function createMockRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const request = {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((name: string) => headers[name] || null),
    },
  } as unknown as NextRequest;
  return request;
}

describe("/api/auth/login/route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authorizeCredentials as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      role: "MEMBER",
    });
  });

  it("returns 400 when email or password is missing", async () => {
    const request = createMockRequest({ email: "test@example.com" });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("E-Mail und Passwort sind erforderlich");
  });

  it("returns 429 when credentials provider signals rate limit", async () => {
    (authorizeCredentials as jest.Mock).mockRejectedValue(new Error("RATE_LIMITED:2"));

    const request = createMockRequest({
      email: "test@example.com",
      password: "password123",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Zu viele fehlgeschlagene Anmeldeversuche");
  });

  it("returns 401 when credentials are invalid", async () => {
    (authorizeCredentials as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest({
      email: "test@example.com",
      password: "wrongpassword",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Ungültige E-Mail oder Passwort");
    expect(logError).toHaveBeenCalledWith(
      'login_failed',
      'Login attempt failed: invalid credentials',
      expect.any(Object)
    );
  });

  it("returns 200 on successful login", async () => {
    (authorizeCredentials as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      role: "MEMBER",
    });

    const request = createMockRequest({
      email: "test@example.com",
      password: "correctpassword",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  describe("correlation ID headers", () => {
    it("should add X-Correlation-Id header on successful login", async () => {
      (authorizeCredentials as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        role: "MEMBER",
      });

      const request = createMockRequest({
        email: "test@example.com",
        password: "correctpassword",
      });

      const response = await POST(request);

      expect(response.headers.get('X-Correlation-Id')).toBeDefined();
      expect(response.headers.get('X-Correlation-Id')).toMatch(/^\d+-[a-z0-9]{7}$/);
    });

    it("should add X-Correlation-Id header on 400 error", async () => {
      const request = createMockRequest({ email: "test@example.com" });

      const response = await POST(request);

      expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header on 401 error", async () => {
      (authorizeCredentials as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        email: "test@example.com",
        password: "wrongpassword",
      });

      const response = await POST(request);

      expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header on 429 rate limit", async () => {
      (authorizeCredentials as jest.Mock).mockRejectedValue(new Error("RATE_LIMITED:1"));

      const request = createMockRequest({
        email: "test@example.com",
        password: "password123",
      });

      const response = await POST(request);

      expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header on 500 error", async () => {
      (authorizeCredentials as jest.Mock).mockRejectedValue(new Error("Network error"));

      const request = createMockRequest({
        email: "test@example.com",
        password: "password123",
      });

      const response = await POST(request);

      expect(response.headers.get('X-Correlation-Id')).toBeDefined();
    });
  });

  it("handles unexpected errors", async () => {
    (authorizeCredentials as jest.Mock).mockRejectedValue(new Error("Network error"));

    const request = createMockRequest({
      email: "test@example.com",
      password: "password123",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
    expect(logError).toHaveBeenCalledWith(
      'login_error',
      'Unexpected error during login',
      expect.any(Object)
    );
  });
  it("should generate unique correlation IDs for each request", async () => {
    (authorizeCredentials as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      role: "MEMBER",
    });

    const request1 = createMockRequest({
      email: "test@example.com",
      password: "password123",
    });

    const request2 = createMockRequest({
      email: "test@example.com",
      password: "password123",
    });

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    const id1 = response1.headers.get('X-Correlation-Id');
    const id2 = response2.headers.get('X-Correlation-Id');

    expect(id1).not.toBe(id2);
  });
});

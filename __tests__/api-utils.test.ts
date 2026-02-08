import { NextResponse } from "next/server";
import { withApiErrorHandling, BadRequestError, PayloadTooLargeError, parseJsonBody, logApiError, validateRequestBody, validateCsrfHeaders, CsrfError, MAX_REQUEST_BODY_SIZE, getMaxSizeMB } from "@/lib/api-utils";
import { logError, logWarn } from "@/lib/logger";

jest.mock("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
}));

describe("withApiErrorHandling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("successful responses", () => {
    it("returns NextResponse as-is when handler succeeds", async () => {
      const mockResponse = NextResponse.json({ success: true });
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result).toBe(mockResponse);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      const data = await result.json();
      expect(data).toEqual({ success: true });
    });

    it("passes arguments to the handler", async () => {
      const mockResponse = NextResponse.json({ ok: true });
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const request = { url: "http://test.com" };
      const context = { params: Promise.resolve({ id: "123" }) };
      await wrappedHandler(request, context);

      expect(mockHandler).toHaveBeenCalledWith(request, context);
    });
  });

  describe("BadRequestError handling", () => {
    it("returns 400 status with error message", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new BadRequestError("Invalid data"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.status).toBe(400);
      const data = await result.json();
      expect(data.error).toBe("Invalid data");
    });

    it("uses default error message", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new BadRequestError());
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.status).toBe(400);
      const data = await result.json();
      expect(data.error).toBe("Ungültige Anfrage");
    });
  });

  describe("UnauthorizedError handling", () => {
    it("returns 401 status with German message", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error());
      const unauthorizedError = new Error();
      unauthorizedError.name = "UnauthorizedError";
      mockHandler.mockRejectedValue(unauthorizedError);

      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result.status).toBe(401);
      const data = await result.json();
      expect(data.error).toBe("Nicht autorisiert");
    });
  });

  describe("ForbiddenError handling", () => {
    it("returns 403 status with German message", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error());
      const forbiddenError = new Error();
      forbiddenError.name = "ForbiddenError";
      mockHandler.mockRejectedValue(forbiddenError);

      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.error).toBe("Keine Berechtigung");
    });
  });

  describe("PayloadTooLargeError handling", () => {
    it("returns 413 status with German message", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new PayloadTooLargeError("Request body zu groß"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.status).toBe(413);
      const data = await result.json();
      expect(data.error).toBe("Request body zu groß");
    });

    it("returns 413 status with message including max size", async () => {
      const maxSizeMB = getMaxSizeMB();
      const mockHandler = jest.fn().mockRejectedValue(new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.status).toBe(413);
      const data = await result.json();
      expect(data.error).toContain("Request body zu groß");
      expect(data.error).toContain("maximal");
      expect(data.error).toContain("MB");
    });
  });

  describe("generic error handling", () => {
    it("returns 500 status with German message", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error("Database error"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result.status).toBe(500);
      const data = await result.json();
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
    });

    it("logs error with route info", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error("Database error"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/api/events", method: "GET" });

      await wrappedHandler();

      expect(logError).toHaveBeenCalledWith(
        'api_error',
        'API error in /api/events',
        expect.objectContaining({
          route: '/api/events',
          method: 'GET',
          status: 500,
          name: 'Error',
          message: 'Database error',
        })
      );
    });

    it("handles non-Error objects", async () => {
      const mockHandler = jest.fn().mockRejectedValue("string error");
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.status).toBe(500);
      const data = await result.json();
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
      expect(logError).toHaveBeenCalledWith('api_error', 'API error in /test', expect.objectContaining({ error: 'string error' }));
    });

    it("handles null errors", async () => {
      const mockHandler = jest.fn().mockRejectedValue(null);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result.status).toBe(500);
      const data = await result.json();
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
    });
  });

  describe("logApiError", () => {
    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it("logs Error objects with full details including stack in development", () => {
      process.env.NODE_ENV = 'development';
      const error = new Error("Test error");
      logApiError(error, { route: "/test", method: "GET", status: 500 });

      expect(logError).toHaveBeenCalledWith(
        'api_error',
        'API error in /test',
        expect.objectContaining({
          route: '/test',
          method: 'GET',
          status: 500,
          name: 'Error',
          message: 'Test error',
          stack: expect.any(String),
        })
      );
    });

    it("hides stack traces in production", () => {
      process.env.NODE_ENV = 'production';
      const error = new Error("Test error");
      logApiError(error, { route: "/test", method: "GET", status: 500 });

      expect(logError).toHaveBeenCalledWith(
        'api_error',
        'API error in /test',
        expect.objectContaining({
          route: '/test',
          method: 'GET',
          status: 500,
          name: 'Error',
          message: 'Test error',
        })
      );

      const loggedContext = (logError as jest.Mock).mock.calls[0][2];
      expect(loggedContext.stack).toBeUndefined();
    });

    it("logs non-Error objects", () => {
      logApiError("string error", { route: "/test" });

      expect(logError).toHaveBeenCalledWith(
        'api_error',
        'API error in /test',
        expect.objectContaining({ error: 'string error' })
      );
    });

    it("uses default context when not provided", () => {
      const error = new Error("Test");
      logApiError(error);

      expect(logError).toHaveBeenCalledWith(
        'api_error',
        'API error in unknown',
        expect.objectContaining({
          name: 'Error',
          message: 'Test',
        })
      );
    });
  });

  describe("MAX_REQUEST_BODY_SIZE configuration", () => {
    it("has a default value of 1MB", () => {
      expect(MAX_REQUEST_BODY_SIZE).toBe(1048576);
    });

    it("is evaluated at module load time from environment variable", () => {
      const envValue = process.env.MAX_REQUEST_BODY_SIZE || "1048576";
      expect(MAX_REQUEST_BODY_SIZE).toBe(parseInt(envValue, 10));
    });
  });

  describe("getMaxSizeMB", () => {
    it("returns correct MB value for current MAX_REQUEST_BODY_SIZE", () => {
      const expectedMB = (MAX_REQUEST_BODY_SIZE / 1024 / 1024).toFixed(1);
      expect(getMaxSizeMB()).toBe(expectedMB);
    });

    it("returns a string with 1 decimal place", () => {
      const result = getMaxSizeMB();
      expect(result).toMatch(/^\d+\.\d$/);
    });

    it("returns correct value for default 1MB size", () => {
      expect(getMaxSizeMB()).toBe("1.0");
    });
  });

  describe("parseJsonBody", () => {
    it("parses valid JSON body", async () => {
      const mockRequest = new Request("http://test.com", {
        method: "POST",
        body: JSON.stringify({ name: "Test", value: 123 }),
        headers: { "content-type": "application/json" },
      });

      const result = await parseJsonBody<{ name: string; value: number }>(mockRequest);

      expect(result).toEqual({ name: "Test", value: 123 });
    });

    it("throws BadRequestError for invalid JSON", async () => {
      const mockRequest = new Request("http://test.com", {
        method: "POST",
        body: "{ invalid json }",
        headers: { "content-type": "application/json" },
      });

      await expect(parseJsonBody(mockRequest)).rejects.toThrow(BadRequestError);
    });

    it("throws PayloadTooLargeError when content-length exceeds limit", async () => {
      const maxSizeMB = getMaxSizeMB();
      const largeContent = "x".repeat(1024 * 1024 + 1);
      const mockRequest = new Request("http://test.com", {
        method: "POST",
        body: largeContent,
        headers: {
          "content-type": "application/json",
          "content-length": (1024 * 1024 + 1).toString(),
        },
      });

      await expect(parseJsonBody(mockRequest)).rejects.toThrow(PayloadTooLargeError);
      try {
        await parseJsonBody(mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PayloadTooLargeError);
        if (error instanceof Error) {
          expect(error.message).toContain("Request body zu groß");
          expect(error.message).toContain(`maximal ${maxSizeMB} MB`);
        }
      }
    });

    it("throws PayloadTooLargeError when parsed JSON exceeds limit", async () => {
      const maxSizeMB = getMaxSizeMB();
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 20000; i++) {
        largeObject[`key${i}`] = "x".repeat(50);
      }

      const mockRequest = new Request("http://test.com", {
        method: "POST",
        body: JSON.stringify(largeObject),
        headers: { "content-type": "application/json" },
      });

      await expect(parseJsonBody(mockRequest)).rejects.toThrow(PayloadTooLargeError);
      try {
        await parseJsonBody(mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PayloadTooLargeError);
        if (error instanceof Error) {
          expect(error.message).toContain("Request body zu groß");
          expect(error.message).toContain(`maximal ${maxSizeMB} MB`);
        }
      }
    });

    it("accepts body within size limit", async () => {
      const smallContent = { name: "Test", data: "Small content" };
      const mockRequest = new Request("http://test.com", {
        method: "POST",
        body: JSON.stringify(smallContent),
        headers: {
          "content-type": "application/json",
          "content-length": "100",
        },
      });

      const result = await parseJsonBody(mockRequest);

      expect(result).toEqual(smallContent);
    });

    it("handles requests without content-length header", async () => {
      const smallContent = { test: "value" };
      const mockRequest = new Request("http://test.com", {
        method: "POST",
        body: JSON.stringify(smallContent),
        headers: { "content-type": "application/json" },
      });

      const result = await parseJsonBody(mockRequest);

      expect(result).toEqual(smallContent);
    });
  });

  describe("validateRequestBody", () => {
    const mockLogValidationFailure = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      mockLogValidationFailure.mockClear();
    });

    it("validates body with correct types", () => {
      const schema = {
        name: { type: 'string' as const },
        age: { type: 'number' as const },
        active: { type: 'boolean' as const },
      } as const;

      const body = { name: "John", age: 30, active: true };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects unexpected fields", () => {
      const schema = {
        name: { type: 'string' as const },
      } as const;

      const body = { name: "John", unexpected: "field" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unerwartetes Feld: unexpected");
    });

    it("rejects fields with wrong type", () => {
      const schema = {
        age: { type: 'number' as const },
      } as const;

      const body = { age: "thirty" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Feld 'age' muss vom Typ number sein, ist aber string");
    });

    it("accepts null and undefined values for optional fields", () => {
      const schema = {
        name: { type: 'string' as const, optional: true },
      } as const;

      const result1 = validateRequestBody({ name: null }, schema, { route: '/test', method: 'POST' });
      expect(result1.isValid).toBe(true);

      const result2 = validateRequestBody({ name: undefined }, schema, { route: '/test', method: 'POST' });
      expect(result2.isValid).toBe(true);

      const result3 = validateRequestBody({}, schema, { route: '/test', method: 'POST' });
      expect(result3.isValid).toBe(true);
    });

    it("validates array type", () => {
      const schema = {
        tags: { type: 'array' as const },
      } as const;

      const body = { tags: ["tag1", "tag2"] };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(true);
    });

    it("rejects non-array for array type", () => {
      const schema = {
        tags: { type: 'array' as const },
      } as const;

      const body = { tags: "not-an-array" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Feld 'tags' muss vom Typ array sein, ist aber string");
    });

    it("validates object type", () => {
      const schema = {
        metadata: { type: 'object' as const },
      } as const;

      const body = { metadata: { key: "value" } };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(true);
    });

    it("rejects non-object for object type", () => {
      const schema = {
        metadata: { type: 'object' as const },
      } as const;

      const body = { metadata: "not-an-object" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Feld 'metadata' muss vom Typ object sein, ist aber string");
    });

    it("accepts null for object type (null is not an object in typeof)", () => {
      const schema = {
        metadata: { type: 'object' as const },
      } as const;

      const result = validateRequestBody({ metadata: null }, schema, { route: '/test', method: 'POST' });
      expect(result.isValid).toBe(true);
    });

    it("uses custom validator when provided", () => {
      const schema = {
        email: { type: 'string' as const, validator: (v) => typeof v === 'string' && v.includes('@') },
      } as const;

      const body = { email: "invalid-email" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiger Wert für Feld 'email'");
    });

    it("passes valid data with custom validator", () => {
      const schema = {
        email: { type: 'string' as const, validator: (v) => typeof v === 'string' && v.includes('@') },
      } as const;

      const body = { email: "valid@example.com" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(true);
    });

    it("returns multiple errors for multiple validation failures", () => {
      const schema = {
        name: { type: 'string' as const },
        age: { type: 'number' as const },
      } as const;

      const body = { name: 123, age: "thirty", unexpected: "field" };
      const result = validateRequestBody(body, schema, { route: '/test', method: 'POST' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain("Feld 'name' muss vom Typ string sein, ist aber number");
      expect(result.errors).toContain("Feld 'age' muss vom Typ number sein, ist aber string");
      expect(result.errors).toContain("Unerwartetes Feld: unexpected");
    });
  });

  describe("validateCsrfHeaders", () => {
    const originalAppUrl = process.env.APP_URL;

    afterEach(() => {
      process.env.APP_URL = originalAppUrl;
    });

    describe("with APP_URL configured", () => {
      beforeEach(() => {
        process.env.APP_URL = "https://example.com";
      });

      it("accepts valid Origin header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "origin": "https://example.com",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("accepts valid Referer header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "referer": "https://example.com/page",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("rejects invalid Origin header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "origin": "https://evil.com",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).toThrow(CsrfError);
      });

      it("rejects invalid Referer header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "referer": "https://evil.com/page",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).toThrow(CsrfError);
      });

      it("rejects when both Origin and Referer are missing for browser requests", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).toThrow(CsrfError);
      });

      it("allows requests without Origin or Referer for non-browser clients", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "curl/7.68.0",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("allows requests without user-agent header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("accepts same-origin requests with Origin header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "origin": "https://example.com",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("accepts same-origin requests with Referer header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "referer": "https://example.com/some-page",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("rejects cross-origin requests with Origin header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "origin": "https://malicious-site.com",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).toThrow(CsrfError);
      });

      it("rejects cross-origin requests with Referer header", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "referer": "https://malicious-site.com/page",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).toThrow(CsrfError);
      });

      it("handles multipart/form-data content type", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "origin": "https://example.com",
            "content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("handles application/x-www-form-urlencoded content type", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "referer": "https://example.com/page",
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });

      it("rejects browser mutating requests without Origin/Referer regardless of content type", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).toThrow(CsrfError);
      });

      it("skips CSRF validation for non-mutating methods", () => {
        const mockRequest = new Request("https://example.com/api/test", {
          method: "GET",
          headers: {
            "origin": "https://evil.com",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });
    });

    describe("without APP_URL configured", () => {
      beforeEach(() => {
        delete process.env.APP_URL;
      });

      it("does not validate when APP_URL is not configured", () => {
        const mockRequest = new Request("http://localhost:3000/api/test", {
          method: "POST",
          headers: {
            "origin": "https://evil.com",
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Test Browser)",
          },
        });

        expect(() => validateCsrfHeaders(mockRequest)).not.toThrow();
      });
    });

    describe("CsrfError", () => {
      it("has correct name", () => {
        const error = new CsrfError();
        expect(error.name).toBe("CsrfError");
      });

      it("has default message", () => {
        const error = new CsrfError();
        expect(error.message).toBe("Ungültiger Origin oder Referer Header. Bitte versuchen Sie es erneut.");
      });

      it("accepts custom message", () => {
        const error = new CsrfError("Custom CSRF error");
        expect(error.message).toBe("Custom CSRF error");
      });

      it("is instance of Error", () => {
        const error = new CsrfError();
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe("withApiErrorHandling with CsrfError", () => {
      it("returns 403 status with CSRF error message", async () => {
        const mockHandler = jest.fn().mockRejectedValue(new CsrfError("CSRF validation failed"));
        const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

        const result = await wrappedHandler();

        expect(result.status).toBe(403);
        const data = await result.json();
        expect(data.error).toBe("CSRF validation failed");
      });

      it("uses default CSRF error message", async () => {
        const mockHandler = jest.fn().mockRejectedValue(new CsrfError());
        const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

        const result = await wrappedHandler();

        expect(result.status).toBe(403);
        const data = await result.json();
        expect(data.error).toBe("Ungültiger Origin oder Referer Header. Bitte versuchen Sie es erneut.");
      });

      it("logs CSRF errors as access denied", async () => {
        const mockHandler = jest.fn().mockRejectedValue(new CsrfError("CSRF failed"));
        const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

        await wrappedHandler();

        expect(logWarn).toHaveBeenCalledWith(
          'access_denied',
          'Access denied for /test',
          expect.objectContaining({
            route: '/test',
            method: 'POST',
            reason: 'CSRF validation failed',
          })
        );
      });
    });
  });

  describe("correlation ID headers", () => {
    it("should add X-Correlation-Id header to successful responses", async () => {
      const mockResponse = NextResponse.json({ success: true });
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
      expect(result.headers.get('X-Correlation-Id')).toMatch(/^\d+-[a-z0-9]{7}$/);
    });

    it("should add X-Correlation-Id header to error responses (BadRequest)", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new BadRequestError("Invalid data"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header to error responses (401)", async () => {
      const unauthorizedError = new Error();
      unauthorizedError.name = "UnauthorizedError";
      const mockHandler = jest.fn().mockRejectedValue(unauthorizedError);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header to error responses (403)", async () => {
      const forbiddenError = new Error();
      forbiddenError.name = "ForbiddenError";
      const mockHandler = jest.fn().mockRejectedValue(forbiddenError);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header to error responses (500)", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error("Database error"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header to error responses (413)", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new PayloadTooLargeError("Request body zu groß"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should add X-Correlation-Id header to error responses (CsrfError)", async () => {
      const mockHandler = jest.fn().mockRejectedValue(new CsrfError("CSRF validation failed"));
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "POST" });

      const result = await wrappedHandler();

      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });

    it("should preserve existing response headers", async () => {
      const mockResponse = NextResponse.json({ success: true });
      mockResponse.headers.set('Content-Type', 'application/json');
      mockResponse.headers.set('X-Custom-Header', 'custom-value');
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withApiErrorHandling(mockHandler, { route: "/test", method: "GET" });

      const result = await wrappedHandler();

      expect(result.headers.get('Content-Type')).toBe('application/json');
      expect(result.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(result.headers.get('X-Correlation-Id')).toBeDefined();
    });
  });
});

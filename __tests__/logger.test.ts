import { maskToken, maskEmail } from "../lib/logger";

describe("maskToken", () => {
  it("should return first 6 characters followed by ... for normal tokens", () => {
    const token = "abcdef1234567890";
    const masked = maskToken(token);
    expect(masked).toBe("abcdef...");
  });

  it("should return *** for short tokens (<= 6 characters)", () => {
    const shortToken = "abc";
    const masked = maskToken(shortToken);
    expect(masked).toBe("***");
  });

  it("should return *** for exactly 6 characters", () => {
    const token = "abcdef";
    const masked = maskToken(token);
    expect(masked).toBe("***");
  });

  it("should return *** for empty string", () => {
    const masked = maskToken("");
    expect(masked).toBe("***");
  });

  it("should return *** for null", () => {
    const masked = maskToken(null as unknown as string);
    expect(masked).toBe("***");
  });

  it("should return *** for undefined", () => {
    const masked = maskToken(undefined as unknown as string);
    expect(masked).toBe("***");
  });

  it("should handle 64 character hex tokens (typical reset/invitation tokens)", () => {
    const token = "a".repeat(64);
    const masked = maskToken(token);
    expect(masked).toBe("aaaaaa...");
    expect(masked.length).toBe(9);
  });

  it("should not expose any part of the token when length <= 6", () => {
    const token = "secret";
    const masked = maskToken(token);
    expect(masked).toBe("***");
    expect(masked).not.toContain(token);
  });
});

describe("maskEmail", () => {
  it("should mask a normal email address", () => {
    const email = "test@example.com";
    const masked = maskEmail(email);
    expect(masked).toBe("tes***t@example.com");
  });

  it("should mask a long local part email", () => {
    const email = "verylongemailaddress@example.com";
    const masked = maskEmail(email);
    expect(masked).toBe("ver***s@example.com");
  });

  it("should handle short local part (<= 3 chars)", () => {
    const email = "ab@example.com";
    const masked = maskEmail(email);
    expect(masked).toBe("ab***@example.com");
  });

  it("should handle exactly 3 character local part", () => {
    const email = "abc@example.com";
    const masked = maskEmail(email);
    expect(masked).toBe("abc***@example.com");
  });

  it("should handle empty string", () => {
    const masked = maskEmail("");
    expect(masked).toBe("***@***.***");
  });

  it("should handle null", () => {
    const masked = maskEmail(null as unknown as string);
    expect(masked).toBe("***@***.***");
  });

  it("should handle undefined", () => {
    const masked = maskEmail(undefined as unknown as string);
    expect(masked).toBe("***@***.***");
  });

  it("should handle email without @", () => {
    const email = "invalidemail";
    const masked = maskEmail(email);
    expect(masked).toBe("***@***.***");
  });

  it("should not expose the full email address", () => {
    const email = "john.doe@example.com";
    const masked = maskEmail(email);
    expect(masked).not.toBe(email);
    expect(masked).toContain("***");
  });
});

describe("logging redaction", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("sensitive field redaction", () => {
    it("should redact 'token' field", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { token: "sensitive-token-value" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining("sensitive-token-value")
      );
    });

    it("should redact 'password' field", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { password: "secret123" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"password":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining("secret123")
      );
    });

    it("should redact 'authorization' field", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { authorization: "Bearer secret-token" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"authorization":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining("Bearer secret-token")
      );
    });

    it("should redact 'cookie' field", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { cookie: "session=secret123" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"cookie":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining("session=secret123")
      );
    });

    it("should redact 'smtpPassword' field", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { smtpPassword: "smtp-secret" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"smtpPassword":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.not.stringContaining("smtp-secret")
      );
    });

    it("should redact fields with different casing", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { Token: "value", PASSWORD: "secret" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"Token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"PASSWORD":"[REDACTED]"')
      );
    });

    it("should redact multiple sensitive fields in one log entry", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", {
        token: "token123",
        password: "pass456",
        safeField: "safe-value"
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"password":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"safeField":"safe-value"')
      );
    });

    it("should preserve non-sensitive field values", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", {
        email: "user@example.com",
        name: "John Doe",
        userId: "12345"
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"email":"user@example.com"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name":"John Doe"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"userId":"12345"')
      );
    });

    it("should handle nested objects and redact sensitive fields", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", {
        user: { token: "secret-token", name: "John" },
        metadata: { apiKey: "key123" }
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name":"John"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"apiKey":"key123"')
      );
    });

    it("should handle arrays with objects containing sensitive fields", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", {
        tokens: [{ token: "secret1", id: "1" }, { token: "secret2", id: "2" }]
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"id":"1"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"id":"2"')
      );
    });

    it("should handle null and undefined values in context", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", {
        token: null,
        password: undefined,
        name: "John"
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name":"John"')
      );
    });

    it("should redact values in arrays that are themselves objects", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", {
        items: [{ token: "secret1", id: "1" }, { token: "secret2", id: "2" }]
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"id":"1"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"id":"2"')
      );
    });
  });
});

import { withCorrelationId } from '../lib/correlation-id';

describe("correlation ID logging", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("with correlation ID context", () => {
    it("should include correlation ID in log entries when context exists", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;

      withCorrelationId("test-correlation-id-123", () => {
        originalLogInfo("test_action", "test message", { key: "value" });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[test-correlation-id-123]")
      );
    });

    it("should include correlation ID in error log entries", () => {
      const originalLogError = jest.requireActual("../lib/logger").logError;

      withCorrelationId("error-correlation-id-456", () => {
        originalLogError("test_error", "error message", { error: "details" });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[error-correlation-id-456]")
      );
    });

    it("should include correlation ID in warning log entries", () => {
      const originalLogWarn = jest.requireActual("../lib/logger").logWarn;

      withCorrelationId("warn-correlation-id-789", () => {
        originalLogWarn("test_warn", "warning message", { warn: "details" });
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[warn-correlation-id-789]")
      );
    });

    it("should place correlation ID before log level", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;

      withCorrelationId("test-id", () => {
        originalLogInfo("test_action", "test message");
      });

      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/^\[.*\] \[test-id\] \[INFO\]/);
    });
  });

  describe("without correlation ID context", () => {
    it("should not include correlation ID brackets when no context exists", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { key: "value" });

      const logEntry = consoleLogSpy.mock.calls[0][0] as string;
      expect(logEntry).toMatch(/^\[.*\] \[INFO\] \[test_action\]/);
      expect(logEntry).not.toMatch(/^\[.*\] \[.*\] \[INFO\] \[test_action\]/);
    });

    it("should log normally when correlation ID is undefined", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[INFO\] \[test_action\] test message$/)
      );
    });
  });
});

describe("logger functions", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("logInfo", () => {
    it("should log info messages", () => {
      const originalLogInfo = jest.requireActual("../lib/logger").logInfo;
      originalLogInfo("test_action", "test message", { key: "value" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[INFO\] \[test_action\] test message/)
      );
    });
  });

  describe("logError", () => {
    it("should log error messages", () => {
      const originalLogError = jest.requireActual("../lib/logger").logError;
      originalLogError("test_error", "error message", { error: "details" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[ERROR\] \[test_error\] error message/)
      );
    });
  });

  describe("logWarn", () => {
    it("should log warning messages", () => {
      const originalLogWarn = jest.requireActual("../lib/logger").logWarn;
      originalLogWarn("test_warn", "warning message", { warn: "details" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] \[test_warn\] warning message/)
      );
    });
  });

  describe("logResourceNotFound", () => {
    it("should log resource not found warnings", () => {
      const originalLogResourceNotFound = jest.requireActual("../lib/logger").logResourceNotFound;
      originalLogResourceNotFound("user", "123", "/api/users/123", "GET", { reason: "deleted" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] \[resource_not_found\] user not found/)
      );
    });
  });

  describe("logValidationFailure", () => {
    it("should log validation failure warnings with string errors", () => {
      const originalLogValidationFailure = jest.requireActual("../lib/logger").logValidationFailure;
      originalLogValidationFailure("/api/test", "POST", "Invalid input", { field: "email" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] \[validation_failed\] Request validation failed/)
      );
    });

    it("should log validation failure warnings with array errors", () => {
      const originalLogValidationFailure = jest.requireActual("../lib/logger").logValidationFailure;
      originalLogValidationFailure("/api/test", "POST", ["Error 1", "Error 2"], { field: "email" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] \[validation_failed\] Request validation failed/)
      );
    });
  });
});

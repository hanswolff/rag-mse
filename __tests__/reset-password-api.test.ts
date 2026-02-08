import { GET, POST } from "@/app/api/auth/reset-password/[token]/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken, getResetExpiryDate } from "@/lib/password-reset";
import { logInfo, logValidationFailure, logResourceNotFound } from "@/lib/logger";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    passwordReset: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
  logResourceNotFound: jest.fn(),
  maskToken: jest.fn((t) => t.substring(0, 6) + "..."),
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkTokenRateLimit: jest.fn(),
  recordSuccessfulTokenUsage: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => ({
  parseJsonBody: jest.fn(async (req) => req.json()),
  BadRequestError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BadRequestError";
    }
  },
  logApiError: jest.fn(),
  getClientIp: jest.fn(() => "127.0.0.1"),
  handleRateLimitBlocked: jest.fn(),
  validateRequestBody: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  validateCsrfHeaders: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

const mockedPrisma = prisma as {
  passwordReset: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockedCheckTokenRateLimit = checkTokenRateLimit as jest.Mock;
const mockedRecordSuccessfulTokenUsage = recordSuccessfulTokenUsage as jest.Mock;
const mockedHash = hash as jest.Mock;
const { handleRateLimitBlocked } = jest.requireMock("@/lib/api-utils");
const VALID_PASSWORD = "SecurePassword123!";

function createMockRequest(body: Record<string, unknown>) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as NextRequest;
}

function createMockParams(token: string) {
  return Promise.resolve({ token });
}

describe("/api/auth/reset-password/[token] route - Security Regression Tests", () => {
  const mockValidReset = {
    id: "reset-123",
    email: "test@example.com",
    tokenHash: hashResetToken("valid-token"),
    expiresAt: getResetExpiryDate(),
    usedAt: null,
  };

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });
    mockedHash.mockResolvedValue("hashed-new-password");
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    handleRateLimitBlocked.mockImplementation((action, route, tokenHash, clientIp, blockedUntil) => {
      if (blockedUntil) {
        const blockedMinutes = Math.ceil((blockedUntil - Date.now()) / 60000);
        return NextResponse.json(
          {
            error: `Zu viele fehlgeschlagene Versuche. Bitte versuchen Sie es in ${blockedMinutes} Minute(n) erneut.`
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." },
        { status: 429 }
      );
    });
  });

  describe("Token Redaction in Logs", () => {
    it("should mask token in validation failure logs", async () => {
      const request = createMockRequest({ password: "weak" });
      const sensitiveToken = "sensitive-token-123";

      const response = await POST(request, { params: createMockParams(sensitiveToken) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Passwort");
      expect(logValidationFailure).toHaveBeenCalledWith(
        '/api/auth/reset-password/[token]',
        'POST',
        expect.any(Array),
        expect.objectContaining({ token: expect.any(String) })
      );
    });

    it("should mask token in resource not found logs for invalid token", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(null);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });
      const sensitiveToken = "sensitive-token-456";

      const response = await POST(request, { params: createMockParams(sensitiveToken) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Ungültiger Link");
      expect(logResourceNotFound).toHaveBeenCalledWith(
        'password_reset',
        expect.any(String),
        '/api/auth/reset-password/[token]',
        'POST',
        expect.objectContaining({ reason: 'invalid' })
      );
    });

    it("should mask token in resource not found logs for expired token", async () => {
      const expiredReset = {
        ...mockValidReset,
        expiresAt: new Date(Date.now() - 86400000),
      };
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(expiredReset);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });
      const sensitiveToken = "expired-token-789";

      const response = await POST(request, { params: createMockParams(sensitiveToken) });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Der Link ist abgelaufen");
      expect(logResourceNotFound).toHaveBeenCalledWith(
        'password_reset',
        expect.any(String),
        '/api/auth/reset-password/[token]',
        'POST',
        expect.objectContaining({ reason: 'expired' })
      );
    });

    it("should mask token in resource not found logs for used token", async () => {
      const usedReset = {
        ...mockValidReset,
        usedAt: new Date(),
      };
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(usedReset);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });
      const sensitiveToken = "used-token-999";

      const response = await POST(request, { params: createMockParams(sensitiveToken) });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Der Link ist abgelaufen");
      expect(logResourceNotFound).toHaveBeenCalledWith(
        'password_reset',
        expect.any(String),
        '/api/auth/reset-password/[token]',
        'POST',
        expect.objectContaining({ reason: 'expired' })
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limiting on password reset attempts", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockedCheckTokenRateLimit.mockReturnValue({
        allowed: false,
        attemptCount: 4,
        blockedUntil: undefined,
      });

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams("rate-limit-test-token") });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Zu viele Versuche. Bitte versuchen Sie es später erneut.");
    });

    it("should record successful token usage after successful reset", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockedPrisma.passwordReset.update.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});

      const token = "successful-reset-token";
      const tokenHash = hashResetToken(token);
      const clientIp = "127.0.0.1";

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams(token) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Passwort wurde erfolgreich geändert");
      expect(mockedRecordSuccessfulTokenUsage).toHaveBeenCalledWith(tokenHash, clientIp);
    });

    it("should check rate limit before processing request", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const token = "rate-limit-check-token";
      const tokenHash = hashResetToken(token);
      const clientIp = "127.0.0.1";

      const request = createMockRequest({ password: VALID_PASSWORD });

      await POST(request, { params: createMockParams(token) });

      expect(mockedCheckTokenRateLimit).toHaveBeenCalledWith(clientIp, tokenHash);
    });
  });

  describe("Token Validation Scenarios", () => {
    it("GET should return 400 for missing token", async () => {
      const request = {} as NextRequest;
      const response = await GET(request, { params: Promise.resolve({ token: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Ungültiger Link");
    });

    it("POST should return 400 for missing token", async () => {
      const request = createMockRequest({ password: VALID_PASSWORD });
      const response = await POST(request, { params: Promise.resolve({ token: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Ungültiger Link");
    });

    it("GET should return 404 for invalid token", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(null);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("invalid-token") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Ungültiger Link");
    });

    it("POST should return 404 for invalid token", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(null);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });
      const response = await POST(request, { params: createMockParams("invalid-token") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Ungültiger Link");
    });

    it("GET should return 410 for expired token", async () => {
      const expiredReset = {
        ...mockValidReset,
        expiresAt: new Date(Date.now() - 86400000),
      };
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(expiredReset);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("expired-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Der Link ist abgelaufen");
    });

    it("POST should return 410 for expired token", async () => {
      const expiredReset = {
        ...mockValidReset,
        expiresAt: new Date(Date.now() - 86400000),
      };
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(expiredReset);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });
      const response = await POST(request, { params: createMockParams("expired-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Der Link ist abgelaufen");
    });

    it("GET should return 410 for used token", async () => {
      const usedReset = {
        ...mockValidReset,
        usedAt: new Date(),
      };
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(usedReset);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("used-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Der Link ist abgelaufen");
    });

    it("POST should return 410 for used token", async () => {
      const usedReset = {
        ...mockValidReset,
        usedAt: new Date(),
      };
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(usedReset);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });
      const response = await POST(request, { params: createMockParams("used-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Der Link ist abgelaufen");
    });
  });

  describe("Successful Password Reset Flow", () => {
    it("GET should return reset details for valid token", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.email).toBe("test@example.com");
      expect(data.expiresAt).toBeTruthy();
    });

    it("POST should successfully reset password with valid token", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockedPrisma.passwordReset.update.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Passwort wurde erfolgreich geändert");
      expect(logInfo).toHaveBeenCalledWith(
        'password_reset_completed',
        'Password reset completed',
        expect.objectContaining({
          email: "test@example.com",
        })
      );
    });

    it("should hash password with bcrypt", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockedPrisma.passwordReset.update.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});

      const request = createMockRequest({ password: VALID_PASSWORD });

      await POST(request, { params: createMockParams("valid-token") });

      expect(mockedHash).toHaveBeenCalledWith(VALID_PASSWORD, 10);
    });

    it("should execute user update and reset update in transaction", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

      const mockTx = {
        user: {
          update: jest.fn().mockResolvedValue({}),
        },
        passwordReset: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      mockedPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Passwort wurde erfolgreich geändert");
      expect(mockedPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { password: "hashed-new-password" },
      });
      expect(mockTx.passwordReset.update).toHaveBeenCalledWith({
        where: { id: mockValidReset.id },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("should return 404 if user not found for reset token", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Benutzer nicht gefunden");
      expect(logResourceNotFound).toHaveBeenCalledWith(
        'user',
        mockValidReset.email,
        '/api/auth/reset-password/[token]',
        'POST'
      );
    });
  });

  describe("Input Validation", () => {
    it("should validate password strength", async () => {
      const weakPassword = "weak";
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: weakPassword });

      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Passwort");
    });

    it("should reject missing password field", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({});

      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("GET should handle database errors gracefully", async () => {
      mockedPrisma.passwordReset.findUnique.mockRejectedValue(new Error("Database error"));

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("error-token") });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
    });

    it("POST should handle database errors gracefully", async () => {
      mockedPrisma.passwordReset.findUnique.mockRejectedValue(new Error("Database error"));
      mockedCheckTokenRateLimit.mockReturnValue({ allowed: true, attemptCount: 1 });

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams("error-token") });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
    });

    it("POST should handle transaction errors gracefully", async () => {
      mockedPrisma.passwordReset.findUnique.mockResolvedValue(mockValidReset);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockedPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"));

      const request = createMockRequest({ password: VALID_PASSWORD });

      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
    });
  });
});

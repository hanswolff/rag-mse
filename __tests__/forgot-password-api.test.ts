import { POST } from "@/app/api/auth/forgot-password/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logError, logValidationFailure } from "@/lib/logger";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/email-sender", () => ({
  sendTemplateEmail: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkForgotPasswordRateLimit: jest.fn().mockReturnValue({ allowed: true, attemptCount: 1 }),
}));

function createMockRequest(body: Record<string, unknown>) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as NextRequest;
}

describe("/api/auth/forgot-password/route", () => {
  const SUCCESS_MESSAGE =
    "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link zum Zurücksetzen Ihres Passworts.";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe("Account Enumeration Prevention", () => {
    it("returns same success message for non-existent email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({ email: "nonexistent@example.com" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(SUCCESS_MESSAGE);
      expect(sendTemplateEmail).not.toHaveBeenCalled();
    });

    it("returns same success message for existing user when email fails to send", async () => {
      const mockUser = { id: "1", email: "existing@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (sendTemplateEmail as jest.Mock).mockRejectedValue(new Error("SMTP error"));

      const request = createMockRequest({ email: "existing@example.com" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(SUCCESS_MESSAGE);
      expect(logError).toHaveBeenCalledWith(
        'email_queue_failed',
        'Failed to queue password reset email',
        expect.objectContaining({
          template: "passwort-zuruecksetzen",
          to: "existing@example.com",
        })
      );
    });

    it("returns same success message for existing user when email succeeds", async () => {
      const mockUser = { id: "1", email: "existing@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({
              id: "reset-1",
              email: "existing@example.com",
              tokenHash: "hash",
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            }),
          },
        };
        await callback(mockTx);
        return "mock-token";
      });

      const request = createMockRequest({ email: "existing@example.com" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(SUCCESS_MESSAGE);
      expect(logInfo).toHaveBeenCalledWith(
        'password_reset_requested',
        'Password reset requested and email queued',
        expect.objectContaining({
          email: "existing@example.com",
        })
      );
    });

    it("ensures response is always 200 for all scenarios", async () => {
      const scenarios = [
        { email: "nonexistent@example.com", userExists: false },
        { email: "existing@example.com", userExists: true, emailError: null },
        { email: "existing@example.com", userExists: true, emailError: new Error("SMTP error") },
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();

        if (scenario.userExists) {
          (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            id: "1",
            email: scenario.email,
          });
          (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
              passwordReset: {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                create: jest.fn().mockResolvedValue({
                  id: "reset-1",
                  email: scenario.email,
                  tokenHash: "hash",
                  expiresAt: new Date(),
                }),
              },
            };
            await callback(mockTx);
            return "mock-token";
          });

          if (scenario.emailError) {
            (sendTemplateEmail as jest.Mock).mockRejectedValue(scenario.emailError);
          } else {
            (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });
          }
        } else {
          (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        }

        const request = createMockRequest({ email: scenario.email });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe(SUCCESS_MESSAGE);
      }
    });
  });

  describe("Input Validation", () => {
    it("returns error for empty email", async () => {
      const request = createMockRequest({ email: "" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Gültige E-Mail-Adresse erforderlich");
      expect(logValidationFailure).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        'POST',
        'Gültige E-Mail-Adresse erforderlich',
        expect.objectContaining({ email: "" })
      );
    });

    it("returns error for email without @ symbol", async () => {
      const request = createMockRequest({ email: "invalid-email" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Gültige E-Mail-Adresse erforderlich");
    });

    it("returns error for null email", async () => {
      const request = createMockRequest({ email: null });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Gültige E-Mail-Adresse erforderlich");
    });

    it("returns error for undefined email", async () => {
      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Gültige E-Mail-Adresse erforderlich");
    });

    it("normalizes email by trimming and lowercasing", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "mock-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "  Test@Example.COM  " });
      await POST(request);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        select: { id: true, email: true },
      });
    });

    it("accepts valid email format", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "mock-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "test@example.com" });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prisma.user.findUnique).toHaveBeenCalled();
    });
  });

  describe("Password Reset Flow", () => {
    it("deletes existing password resets before creating new one", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const mockCreate = jest.fn().mockResolvedValue({});

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: mockDeleteMany,
            create: mockCreate,
          },
        };
        await callback(mockTx);
        return "mock-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(mockCreate).toHaveBeenCalled();
    });

    it("sends email with correct template and variables", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "generated-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "passwort-zuruecksetzen",
          to: "test@example.com",
          variables: expect.objectContaining({
            appName: "RAG Schießsport MSE",
            resetUrl: expect.stringMatching(
              /^http:\/\/localhost:3000\/passwort-zuruecksetzen\/[a-f0-9]{64}$/
            ),
          }),
        })
      );
    });

    it("uses APP_URL as fallback when NEXT_PUBLIC_APP_URL not set", async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.APP_URL = "https://example.com";

      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "generated-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            resetUrl: expect.stringMatching(
              /^https:\/\/example\.com\/passwort-zuruecksetzen\/[a-f0-9]{64}$/
            ),
          }),
        })
      );

      delete process.env.APP_URL;
    });

    it("uses localhost as final fallback", async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.APP_URL;

      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "generated-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            resetUrl: expect.stringMatching(
              /^http:\/\/localhost:3000\/passwort-zuruecksetzen\/[a-f0-9]{64}$/
            ),
          }),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("handles database errors gracefully without leaking information", async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({ email: "test@example.com" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(SUCCESS_MESSAGE);
      expect(logError).toHaveBeenCalledWith(
        'forgot_password_error',
        'Error processing forgot password request',
        expect.objectContaining({
          error: "Database connection failed",
        })
      );
    });

    it("handles JSON parse errors gracefully", async () => {
      (prisma.user.findUnique as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected token");
      });

      const request = createMockRequest({ email: "test@example.com" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(SUCCESS_MESSAGE);
      expect(logError).toHaveBeenCalled();
    });

    it("handles transaction errors gracefully", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("Transaction failed"));

      const request = createMockRequest({ email: "test@example.com" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(SUCCESS_MESSAGE);
      expect(logError).toHaveBeenCalled();
      expect(sendTemplateEmail).not.toHaveBeenCalled();
    });
  });

  describe("Logging", () => {
    it("logs validation failure for invalid email", async () => {
      const request = createMockRequest({ email: "invalid" });
      await POST(request);

      expect(logValidationFailure).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        'POST',
        'Gültige E-Mail-Adresse erforderlich',
        expect.objectContaining({ email: "invalid" })
      );
    });

    it("logs info when password reset email is sent successfully", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "mock-token";
      });
      (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(logInfo).toHaveBeenCalledWith(
        'password_reset_requested',
        'Password reset requested and email queued',
        expect.objectContaining({
          email: "test@example.com",
        })
      );
    });

    it("logs error when email fails to send", async () => {
      const mockUser = { id: "1", email: "test@example.com" };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          passwordReset: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        await callback(mockTx);
        return "mock-token";
      });
      (sendTemplateEmail as jest.Mock).mockRejectedValue(new Error("SMTP connection failed"));

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(logError).toHaveBeenCalledWith(
        'email_queue_failed',
        'Failed to queue password reset email',
        expect.objectContaining({
          template: "passwort-zuruecksetzen",
          to: "test@example.com",
          error: "SMTP connection failed",
        })
      );
    });

    it("logs error for general request processing errors", async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest({ email: "test@example.com" });
      await POST(request);

      expect(logError).toHaveBeenCalledWith(
        'forgot_password_error',
        'Error processing forgot password request',
        expect.objectContaining({
          error: "Database error",
        })
      );
    });
  });
});

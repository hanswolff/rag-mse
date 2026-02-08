import { POST, GET } from "@/app/api/invitations/[token]/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvitationExpiryDate } from "@/lib/invitations";
import { logInfo, logValidationFailure, logResourceNotFound } from "@/lib/logger";
import { logApiError, parseJsonBody } from "@/lib/api-utils";
import { checkTokenRateLimit } from "@/lib/rate-limiter";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    invitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logValidationFailure: jest.fn(),
  logResourceNotFound: jest.fn(),
  logWarn: jest.fn(),
  maskToken: jest.fn((t) => t.substring(0, 8) + "..."),
}));

jest.mock("@/lib/api-utils", () => ({
  BadRequestError: class extends Error {},
  parseJsonBody: jest.fn(),
  logApiError: jest.fn(),
  getClientIp: jest.fn(() => "127.0.0.1"),
  handleRateLimitBlocked: jest.fn(),
  validateRequestBody: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  validateCsrfHeaders: jest.fn(),
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkTokenRateLimit: jest.fn(),
  recordSuccessfulTokenUsage: jest.fn(),
}));

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

describe("/api/invitations/[token] route", () => {
  const mockInvitation = {
    id: "inv-123",
    email: "test@example.com",
    role: "MEMBER",
    tokenHash: "mock-hash",
    usedAt: null,
    expiresAt: getInvitationExpiryDate(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (checkTokenRateLimit as jest.Mock).mockReturnValue({ allowed: true, attemptCount: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        invitation: prisma.invitation,
        user: prisma.user,
      };
      return callback(tx);
    });
    (parseJsonBody as jest.Mock).mockImplementation(async (req: NextRequest) => req.json());
  });

  describe("GET /api/invitations/[token]", () => {
    it("returns invitation details for valid token", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        name: "Max Mustermann",
        address: "Musterstraße 1, 12345 Musterstadt",
        phone: "+49 123 456789",
      });

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.email).toBe("test@example.com");
      expect(data.expiresAt).toBeTruthy();
      expect(data.name).toBe("Max Mustermann");
      expect(data.address).toBe("Musterstraße 1, 12345 Musterstadt");
      expect(data.phone).toBe("+49 123 456789");
    });

    it("returns 400 for missing token", async () => {
      const request = {} as NextRequest;
      const response = await GET(request, { params: Promise.resolve({ token: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Einladung ungültig");
    });

    it("returns 404 for invalid token", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("invalid-token") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Einladung ungültig");
    });

    it("returns 410 for expired invitation", async () => {
      const expiredInvitation = {
        ...mockInvitation,
        usedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(expiredInvitation);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("expired-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung ist abgelaufen");
    });

    it("returns 410 for already used invitation", async () => {
      const usedInvitation = {
        ...mockInvitation,
        usedAt: new Date(),
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(usedInvitation);

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("used-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung ist abgelaufen");
    });

    it("handles errors gracefully", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockRejectedValue(new Error("Database error"));

      const request = {} as NextRequest;
      const response = await GET(request, { params: createMockParams("error-token") });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
      expect(logApiError).toHaveBeenCalled();
    });
  });

  describe("POST /api/invitations/[token] - new user flow", () => {
    const validRequestBody = {
      name: "John Doe",
      address: "123 Main St",
      phone: "123456789",
      password: "SecurePassword123!",
    };

    it("creates a new user account successfully", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // No existing user
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({
        usedAt: null,
        expiresAt: getInvitationExpiryDate(),
      });
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        name: "John Doe",
      });
      (prisma.invitation.update as jest.Mock).mockResolvedValue({});

      const request = createMockRequest(validRequestBody);
      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Konto wurde erstellt");
      expect(data.email).toBe("test@example.com");
      expect(logInfo).toHaveBeenCalledWith('invitation_accepted', expect.stringContaining('created'), expect.any(Object));
    });

    it("requires name field", async () => {
      const invalidBody = { ...validRequestBody, name: "" };

      const request = createMockRequest(invalidBody);
      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name ist erforderlich");
      expect(logValidationFailure).toHaveBeenCalled();
    });

    it("validates password strength", async () => {
      const invalidBody = { ...validRequestBody, password: "weak" };

      const request = createMockRequest(invalidBody);
      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Passwort");
      expect(logValidationFailure).toHaveBeenCalled();
    });
  });

  describe("POST /api/invitations/[token] - existing user flow", () => {
    const validRequestBody = {
      name: "John Updated",
      address: "456 New St",
      phone: "987654321",
      password: "NewSecurePassword123!",
    };

    const existingUser = {
      id: "user-123",
      email: "test@example.com",
      name: "John Doe",
    };

    it("updates existing user account successfully", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({
        usedAt: null,
        expiresAt: getInvitationExpiryDate(),
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        name: "John Updated",
      });
      (prisma.invitation.update as jest.Mock).mockResolvedValue({});

      const request = createMockRequest(validRequestBody);
      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Konto wurde aktualisiert");
      expect(data.email).toBe("test@example.com");
      expect(logInfo).toHaveBeenCalledWith('invitation_accepted', expect.stringContaining('updated'), expect.any(Object));
    });
  });

  describe("POST /api/invitations/[token] - race condition protection", () => {
    it("returns 410 when invitation is already used (race condition)", async () => {
      (prisma.invitation.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockInvitation) // findValidInvitation call
        .mockResolvedValueOnce({ usedAt: new Date(), expiresAt: getInvitationExpiryDate() }); // validateInvitationInTransaction finds it used

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = createMockRequest({
        name: "John Doe",
        address: "123 Main St",
        phone: "123456789",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("used-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung wurde bereits verwendet");
      expect(logResourceNotFound).toHaveBeenCalledWith('invitation', expect.any(String), expect.any(String), 'POST', { reason: 'already_used' });
    });

    it("returns 410 when invitation expired in transaction (race condition)", async () => {
      (prisma.invitation.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockInvitation) // findValidInvitation call
        .mockResolvedValueOnce({ usedAt: null, expiresAt: new Date(Date.now() - 86400000) }); // validateInvitationInTransaction finds it expired

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = createMockRequest({
        name: "John Doe",
        address: "123 Main St",
        phone: "123456789",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("expired-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung ist abgelaufen");
      expect(logResourceNotFound).toHaveBeenCalledWith('invitation', expect.any(String), expect.any(String), 'POST', { reason: 'expired' });
    });

    it("returns 404 when invitation not found in transaction (race condition)", async () => {
      (prisma.invitation.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockInvitation) // findValidInvitation call
        .mockResolvedValueOnce(null); // validateInvitationInTransaction finds it deleted

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = createMockRequest({
        name: "John Doe",
        address: "123 Main St",
        phone: "123456789",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("deleted-token") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Einladung ungültig");
      expect(logResourceNotFound).toHaveBeenCalledWith('invitation', expect.any(String), expect.any(String), 'POST', { reason: 'not_found_in_transaction' });
    });
  });

  describe("POST /api/invitations/[token] - error handling", () => {
    it("returns 400 for missing token", async () => {
      const request = createMockRequest({
        name: "John Doe",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: Promise.resolve({ token: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Einladung ungültig");
    });

    it("returns 404 for invalid token", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        name: "John Doe",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("invalid-token") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Einladung ungültig");
      expect(logResourceNotFound).toHaveBeenCalledWith('invitation', expect.any(String), expect.any(String), 'POST', { reason: 'invalid' });
    });

    it("returns 410 for expired invitation", async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 86400000),
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(expiredInvitation);

      const request = createMockRequest({
        name: "John Doe",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("expired-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung ist abgelaufen");
      expect(logResourceNotFound).toHaveBeenCalledWith('invitation', expect.any(String), expect.any(String), 'POST', { reason: 'expired' });
    });

    it("returns 410 for already used invitation", async () => {
      const usedInvitation = {
        ...mockInvitation,
        usedAt: new Date(),
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(usedInvitation);

      const request = createMockRequest({
        name: "John Doe",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("used-token") });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung ist abgelaufen");
      expect(logResourceNotFound).toHaveBeenCalledWith('invitation', expect.any(String), expect.any(String), 'POST', { reason: 'expired' });
    });

    it("handles unexpected errors gracefully", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockRejectedValue(new Error("Unexpected error"));

      const request = createMockRequest({
        name: "John Doe",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("error-token") });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
      expect(logApiError).toHaveBeenCalled();
    });
  });

  describe("POST /api/invitations/[token] - input handling", () => {
    it("handles missing optional fields (address, phone)", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({
        usedAt: null,
        expiresAt: getInvitationExpiryDate(),
      });
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        name: "John Doe",
      });
      (prisma.invitation.update as jest.Mock).mockResolvedValue({});

      const request = createMockRequest({
        name: "John Doe",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("valid-token") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Konto wurde erstellt");
    });

    it("trims whitespace from name", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({
        usedAt: null,
        expiresAt: getInvitationExpiryDate(),
      });
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        name: "John Doe",
      });
      (prisma.invitation.update as jest.Mock).mockResolvedValue({});

      const request = createMockRequest({
        name: "  John Doe  ",
        password: "SecurePassword123!",
      });
      const response = await POST(request, { params: createMockParams("valid-token") });

      expect(response.status).toBe(200);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "John Doe",
          }),
        })
      );
    });
  });
});

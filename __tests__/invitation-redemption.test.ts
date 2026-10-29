import { POST, GET } from "@/app/api/invitations/[token]/route";
import { NextRequest } from "next/server";
import { apiRequest, routeContext } from "./helpers/request";
import { prisma } from "@/lib/prisma";
import { getInvitationExpiryDate } from "@/lib/invitations";
import { logInfo, logValidationFailure, logResourceNotFound, logError } from "@/lib/logger";
import { parseJsonBody } from "@/lib/request-body-parser";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

jest.mock("@/lib/rate-limiter", () => ({
  checkTokenRateLimit: jest.fn(),
  checkTokenReadRateLimit: jest.fn(),
  recordSuccessfulTokenUsage: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
    getClientIp: jest.fn(() => "127.0.0.1"),
    handleRateLimitBlocked: jest.fn(),
    checkTokenRateLimitWithPolicy: jest.fn(),
    recordSuccessfulTokenUsageWithPolicy: jest.fn(),
  };
});

jest.mock("@/lib/request-body-parser", () => {
  const actual = jest.requireActual("@/lib/request-body-parser");
  return {
    ...actual,
    parseJsonBody: jest.fn(),
    validateRequestBody: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  };
});

jest.mock("@/lib/csrf-validator", () => {
  const actual = jest.requireActual("@/lib/csrf-validator");
  return {
    ...actual,
    validateCsrfHeaders: jest.fn(),
  };
});

function createMockRequest(body: Record<string, unknown>) {
  return apiRequest("POST", "/api/invitations/token", { body });
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
    // clearAllMocks lässt nicht verbrauchte mockResolvedValueOnce-Werte stehen;
    // sie würden sonst in den nächsten Test durchsickern (reihenfolgeabhängig).
    (prisma.invitation.findUnique as jest.Mock).mockReset();
    (prisma.user.findUnique as jest.Mock).mockReset();
    const { checkTokenRateLimit, checkTokenReadRateLimit } = jest.requireMock("@/lib/rate-limiter");
    checkTokenRateLimit.mockResolvedValue({ allowed: true, attemptCount: 1 });
    checkTokenReadRateLimit.mockResolvedValue({ allowed: true, attemptCount: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        invitation: prisma.invitation,
        user: prisma.user,
        $queryRaw: prisma.$queryRaw,
      };
      return callback(tx as unknown as typeof prisma);
    });
    (parseJsonBody as jest.Mock).mockImplementation(async (req: NextRequest) => req.json());
  });

  describe("GET /api/invitations/[token]", () => {
    it("returns invitation details for valid token without exposing stored profile data", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        name: "Max Mustermann",
      });

      const request = createMockRequest({});
      const response = await GET(request, routeContext({ token: "valid-token" }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.email).toBe("test@example.com");
      expect(data.expiresAt).toBeTruthy();
      expect(data.name).toBe("Max Mustermann");
      expect(data).not.toHaveProperty("address");
      expect(data).not.toHaveProperty("phone");
      expect(data).not.toHaveProperty("dateOfBirth");
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ select: { name: true } })
      );
    });

    it("rate-limits token probing on GET", async () => {
      const { checkTokenReadRateLimit } = jest.requireMock("@/lib/rate-limiter");
      checkTokenReadRateLimit.mockResolvedValue({ allowed: false, attemptCount: 5, blockedUntil: Date.now() + 60000 });

      const request = createMockRequest({});
      const response = await GET(request, routeContext({ token: "probed-token" }));

      expect(response.status).toBe(429);
      expect(prisma.invitation.findUnique).not.toHaveBeenCalled();
    });

    it("returns 400 for missing token", async () => {
      const request = createMockRequest({});
      const response = await GET(request, { params: Promise.resolve({ token: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Einladung ungültig");
    });

    it("returns 404 for invalid token", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({});
      const response = await GET(request, routeContext({ token: "invalid-token" }));
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

      const request = createMockRequest({});
      const response = await GET(request, routeContext({ token: "expired-token" }));
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

      const request = createMockRequest({});
      const response = await GET(request, routeContext({ token: "used-token" }));
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe("Einladung ist abgelaufen");
    });

    it("handles errors gracefully", async () => {
      (prisma.invitation.findUnique as jest.Mock).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest({});
      const response = await GET(request, routeContext({ token: "error-token" }));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
      expect(logError).toHaveBeenCalled();
    });
  });

  describe("POST /api/invitations/[token] - new user flow", () => {
    const validRequestBody = {
      name: "John Doe",
      address: "123 Main St",
      phone: "123456789",
      password: "SecurePassword123!",
      confirmPassword: "SecurePassword123!",
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
      const response = await POST(request, routeContext({ token: "valid-token" }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Konto wurde erstellt");
      expect(data.email).toBe("test@example.com");
      expect(logInfo).toHaveBeenCalledWith('invitation_accepted', expect.stringContaining('created'), expect.any(Object));
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordUpdatedAt: expect.any(Date),
            activatedAt: expect.any(Date),
          }),
        })
      );
    });

    it("requires name field", async () => {
      const invalidBody = { ...validRequestBody, name: "" };

      const request = createMockRequest(invalidBody);
      const response = await POST(request, routeContext({ token: "valid-token" }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name ist erforderlich");
      expect(logValidationFailure).toHaveBeenCalled();
    });

    it("validates password strength", async () => {
      const invalidBody = { ...validRequestBody, password: "weak" };

      const request = createMockRequest(invalidBody);
      const response = await POST(request, routeContext({ token: "valid-token" }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Passwort");
      expect(logValidationFailure).toHaveBeenCalled();
    });

    it("rejects non-matching password confirmation", async () => {
      const invalidBody = { ...validRequestBody, confirmPassword: "DifferentPassword123!" };

      const request = createMockRequest(invalidBody);
      const response = await POST(request, routeContext({ token: "valid-token" }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Passwörter stimmen nicht überein");
      expect(logValidationFailure).toHaveBeenCalled();
    });
  });

  describe("POST /api/invitations/[token] - existing user flow", () => {
    const validRequestBody = {
      name: "John Updated",
      address: "456 New St",
      phone: "987654321",
      password: "NewSecurePassword123!",
      confirmPassword: "NewSecurePassword123!",
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
      const response = await POST(request, routeContext({ token: "valid-token" }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Konto wurde aktualisiert");
      expect(data.email).toBe("test@example.com");
      expect(logInfo).toHaveBeenCalledWith('invitation_accepted', expect.stringContaining('updated'), expect.any(Object));
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordUpdatedAt: expect.any(Date),
            activatedAt: expect.any(Date),
            address: "456 New St",
            phone: "987654321",
          }),
        })
      );
    });

    it("keeps stored master data when optional fields are submitted empty", async () => {
      (prisma.invitation.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockInvitation)
        .mockResolvedValueOnce({ usedAt: null, expiresAt: getInvitationExpiryDate() });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(existingUser);
      (prisma.invitation.update as jest.Mock).mockResolvedValue({});

      // Das Einladungs-GET liefert keine Stammdaten mehr, das Formular startet
      // also leer — leere Felder dürfen gespeicherte Werte nicht überschreiben
      const request = createMockRequest({
        name: "John Doe",
        address: "",
        phone: "",
        password: "NewSecurePassword123!",
        confirmPassword: "NewSecurePassword123!",
        dateOfBirth: "",
        rank: "",
        pk: "",
        reservistsAssociation: "",
        associationMemberNumber: "",
        hasPossessionCard: false,
      });
      const response = await POST(request, routeContext({ token: "valid-token" }));

      expect(response.status).toBe(200);
      const updateData = (prisma.user.update as jest.Mock).mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty("address");
      expect(updateData).not.toHaveProperty("phone");
      expect(updateData).not.toHaveProperty("dateOfBirth");
      expect(updateData).not.toHaveProperty("rank");
      expect(updateData).not.toHaveProperty("pk");
      expect(updateData).not.toHaveProperty("reservistsAssociation");
      expect(updateData).not.toHaveProperty("associationMemberNumber");
      expect(updateData).not.toHaveProperty("hasPossessionCard");
      expect(updateData.name).toBe("John Doe");
      expect(updateData.password).toEqual(expect.any(String));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "used-token" }));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "expired-token" }));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "deleted-token" }));
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
        confirmPassword: "SecurePassword123!",
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "invalid-token" }));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "expired-token" }));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "used-token" }));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "error-token" }));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
      expect(logError).toHaveBeenCalled();
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "valid-token" }));
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
        confirmPassword: "SecurePassword123!",
      });
      const response = await POST(request, routeContext({ token: "valid-token" }));

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

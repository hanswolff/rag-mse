import { POST } from "@/app/api/admin/invitations/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { sendInvitationEmail } from "@/lib/invitations";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    invitation: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/invitations", () => ({
  generateInvitationToken: jest.fn(() => "new-token-123"),
  hashInvitationToken: jest.fn((token: string) => `hashed-${token}`),
  getInvitationExpiryDate: jest.fn(() => new Date("2024-12-31T23:59:59Z")),
  buildInviteUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/einladung/${token}`),
  sendInvitationEmail: jest.fn(),
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
  validateRequestBody: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  validateCsrfHeaders: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logValidationFailure: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock("@/lib/user-validation", () => ({
  validateEmail: jest.fn(() => true),
}));

const mockedPrisma = prisma as {
  user: {
    findUnique: jest.Mock;
  };
  invitation: {
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockedRequireAdmin = requireAdmin as jest.Mock;
const mockedSendInvitationEmail = sendInvitationEmail as jest.Mock;

const INVITED_AT_EPOCH = new Date("1970-01-01T00:00:00.000Z");

describe("POST /api/admin/invitations - Unique active invitation per email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = "https://example.com";
    mockedRequireAdmin.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mockedSendInvitationEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("should invalidate old active invitations before creating a new one", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 2 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-123",
      email: "user@example.com",
      tokenHash: "hashed-new-token-123",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Einladung wurde erfolgreich erstellt und versendet.");

    expect(mockedPrisma.$transaction).toHaveBeenCalled();

    expect(mockedPrisma.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        usedAt: null,
      },
      data: {
        usedAt: INVITED_AT_EPOCH,
      },
    });

    expect(mockedPrisma.invitation.create).toHaveBeenCalled();
  });

  it("should handle email with existing active invitations", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-456",
      email: "existing@example.com",
      tokenHash: "hashed-new-token-456",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "existing@example.com" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockedPrisma.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: "existing@example.com",
        usedAt: null,
      },
      data: {
        usedAt: INVITED_AT_EPOCH,
      },
    });
  });

  it("should handle email with no existing active invitations", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-789",
      email: "newuser@example.com",
      tokenHash: "hashed-new-token-789",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "newuser@example.com" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockedPrisma.invitation.updateMany).toHaveBeenCalled();
    expect(mockedPrisma.invitation.create).toHaveBeenCalled();
  });

  it("should invalidate all unused invitations before creating a new one", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-999",
      email: "mixed@example.com",
      tokenHash: "hashed-new-token-999",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "mixed@example.com" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);

    const updateCall = mockedPrisma.invitation.updateMany.mock.calls[0][0];
    expect(updateCall.where.usedAt).toBe(null);
  });

  it("should maintain transaction integrity - if transaction fails, no invitation is created", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"));

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });

  it("should return error if email sending fails", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-111",
      email: "user@example.com",
      tokenHash: "hashed-new-token-111",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });
    mockedSendInvitationEmail.mockResolvedValue({
      success: false,
      error: new Error("SMTP connection failed"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
  });

  it("should normalize email to lowercase and trim", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-222",
      email: "user@example.com",
      tokenHash: "hashed-new-token-222",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "  USER@EXAMPLE.COM  " }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);

    expect(mockedPrisma.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        usedAt: null,
      },
      data: {
        usedAt: INVITED_AT_EPOCH,
      },
    });
  });

  it("should include invitationId in email log context", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "inv-with-id",
      email: "user@example.com",
      tokenHash: "hashed-new-token",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);

    expect(mockedSendInvitationEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      inviteUrl: "https://example.com/einladung/new-token-123",
      logContext: {
        route: "/api/admin/invitations",
        method: "POST",
        invitationId: "inv-with-id",
        userEmail: "admin@example.com",
      },
    });
  });

  it("should return 409 if user already exists", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "existing-user-1",
      email: "existing@example.com",
    });

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "existing@example.com" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Ein Benutzer mit dieser E-Mail existiert bereits");

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("should return 500 if APP_URL is not configured", async () => {
    delete process.env.APP_URL;

    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("APP_URL ist nicht konfiguriert");
  });
});

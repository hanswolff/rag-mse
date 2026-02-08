import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth-utils";
import { sendInvitationEmail } from "../lib/invitations";

jest.mock("../lib/prisma", () => ({
  prisma: {
    invitation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("../lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("../lib/invitations", () => ({
  generateInvitationToken: jest.fn(() => "new-token-123"),
  hashInvitationToken: jest.fn((token: string) => `hashed-${token}`),
  getInvitationExpiryDate: jest.fn(() => new Date("2024-12-31T23:59:59Z")),
  buildInviteUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/einladung/${token}`),
  sendInvitationEmail: jest.fn(),
}));

// Import the route handlers after mocking dependencies
import { POST as resendById } from "../app/api/admin/invitations/[id]/resend/route";
import { POST as resendByEmail } from "../app/api/admin/invitations/resend-by-email/route";

interface MockInvitation {
  id: string;
  email: string;
  tokenHash: string;
  role: string;
  expiresAt: Date;
  usedAt: Date | null;
  invitedBy: {
    email: string;
  } | null;
}

const mockedPrisma = prisma as {
  invitation: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockedRequireAdmin = requireAdmin as jest.Mock;
const mockedSendInvitationEmail = sendInvitationEmail as jest.Mock;
const FUTURE_DATE = new Date("2099-12-31T23:59:59Z");

describe("POST /api/admin/invitations/[id]/resend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = "https://example.com";
    mockedRequireAdmin.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mockedSendInvitationEmail.mockResolvedValue({ success: true });
    mockedPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockedPrisma) => unknown) => callback(mockedPrisma));
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("should resend invitation email successfully", async () => {
    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);
    mockedPrisma.invitation.update.mockResolvedValue({
      ...mockInvitation,
      tokenHash: "hashed-new-token-123",
      expiresAt: FUTURE_DATE,
    });

    const request = new Request("https://example.com/api/admin/invitations/inv-123/resend", {
      method: "POST",
    });
    const response = await resendById(request, {
      params: Promise.resolve({ id: "inv-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Einladung wurde erneut versendet.");
    expect(mockedPrisma.invitation.findUnique).toHaveBeenCalledWith({
      where: { id: "inv-123" },
      include: { invitedBy: true },
    });
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
    expect(mockedPrisma.invitation.updateMany).toHaveBeenCalled();
    expect(mockedPrisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-123" },
      })
    );
    expect(mockedSendInvitationEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      inviteUrl: "https://example.com/einladung/new-token-123",
      logContext: {
        route: "/api/admin/invitations/[id]/resend",
        method: "POST",
        invitationId: "inv-123",
        userEmail: "admin@example.com",
      },
    });
  });

  it("should return 404 if invitation not found", async () => {
    mockedPrisma.invitation.findUnique.mockResolvedValue(null);

    const request = new Request("https://example.com/api/admin/invitations/nonexistent/resend", {
      method: "POST",
    });
    const response = await resendById(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Einladung nicht gefunden");
  });

  it("should return 400 if invitation already used", async () => {
    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: new Date("2024-01-01T00:00:00Z"),
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);

    const request = new Request("https://example.com/api/admin/invitations/inv-123/resend", {
      method: "POST",
    });
    const response = await resendById(request, {
      params: Promise.resolve({ id: "inv-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Einladung wurde bereits verwendet");
  });

  it("should return 400 if APP_URL is not configured", async () => {
    delete process.env.APP_URL;

    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);

    const request = new Request("https://example.com/api/admin/invitations/inv-123/resend", {
      method: "POST",
    });
    const response = await resendById(request, {
      params: Promise.resolve({ id: "inv-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("APP_URL ist nicht konfiguriert");
  });

  it("should return 500 if email sending fails", async () => {
    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);
    mockedPrisma.invitation.update.mockResolvedValue({
      ...mockInvitation,
      tokenHash: "hashed-new-token-123",
    });
    mockedSendInvitationEmail.mockResolvedValue({ success: false, error: new Error("SMTP failed") });

    const request = new Request("https://example.com/api/admin/invitations/inv-123/resend", {
      method: "POST",
    });
    const response = await resendById(request, {
      params: Promise.resolve({ id: "inv-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    expect(mockedPrisma.invitation.update).toHaveBeenCalledWith({
      where: { id: "inv-123" },
      data: {
        tokenHash: "old-hash",
        expiresAt: FUTURE_DATE,
      },
    });
  });
});

describe("POST /api/admin/invitations/resend-by-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = "https://example.com";
    mockedRequireAdmin.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mockedSendInvitationEmail.mockResolvedValue({ success: true });
    mockedPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockedPrisma) => unknown) => callback(mockedPrisma));
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("should resend invitation by email successfully", async () => {
    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findFirst.mockResolvedValue(mockInvitation);
    mockedPrisma.invitation.update.mockResolvedValue({
      ...mockInvitation,
      tokenHash: "hashed-new-token-123",
    });

    const request = new Request("https://example.com/api/admin/invitations/resend-by-email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await resendByEmail(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Einladung wurde erneut versendet.");
    expect(mockedPrisma.invitation.findFirst).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      include: { invitedBy: true },
    });
    expect(sendInvitationEmail).toHaveBeenCalled();
  });

  it("should normalize email to lowercase and trim", async () => {
    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findFirst.mockResolvedValue(mockInvitation);
    mockedPrisma.invitation.update.mockResolvedValue({
      ...mockInvitation,
      tokenHash: "hashed-new-token-123",
    });

    const request = new Request("https://example.com/api/admin/invitations/resend-by-email", {
      method: "POST",
      body: JSON.stringify({ email: "  USER@EXAMPLE.COM  " }),
    });
    const response = await resendByEmail(request);

    expect(response.status).toBe(200);
    expect(mockedPrisma.invitation.findFirst).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      include: { invitedBy: true },
    });
  });

  it("should return 400 for invalid email format", async () => {
    const request = new Request("https://example.com/api/admin/invitations/resend-by-email", {
      method: "POST",
      body: JSON.stringify({ email: "invalid-email" }),
    });
    const response = await resendByEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Ungültiges E-Mail-Format");
  });

  it("should return 404 if no active invitation found for email", async () => {
    mockedPrisma.invitation.findFirst.mockResolvedValue(null);

    const request = new Request("https://example.com/api/admin/invitations/resend-by-email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await resendByEmail(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Keine aktive Einladung für diese E-Mail gefunden");
  });

  it("should return 400 if APP_URL is not configured", async () => {
    delete process.env.APP_URL;

    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findFirst.mockResolvedValue(mockInvitation);

    const request = new Request("https://example.com/api/admin/invitations/resend-by-email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await resendByEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("APP_URL ist nicht konfiguriert");
  });

  it("should return 500 if email sending fails", async () => {
    const mockInvitation: MockInvitation = {
      id: "inv-123",
      email: "user@example.com",
      tokenHash: "old-hash",
      role: "MEMBER",
      expiresAt: FUTURE_DATE,
      usedAt: null,
      invitedBy: {
        email: "admin@example.com",
      },
    };

    mockedPrisma.invitation.findFirst.mockResolvedValue(mockInvitation);
    mockedPrisma.invitation.update.mockResolvedValue({
      ...mockInvitation,
      tokenHash: "hashed-new-token-123",
    });
    mockedSendInvitationEmail.mockResolvedValue({ success: false, error: new Error("SMTP failed") });

    const request = new Request("https://example.com/api/admin/invitations/resend-by-email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await resendByEmail(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    expect(mockedPrisma.invitation.update).toHaveBeenCalledWith({
      where: { id: "inv-123" },
      data: {
        tokenHash: "old-hash",
        expiresAt: FUTURE_DATE,
      },
    });
  });
});

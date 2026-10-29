import { POST } from "@/app/api/admin/invitations/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo } from "@/lib/logger";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

// E-Mail-Versand an der Systemgrenze mocken (SMTP), nicht den Einladungs-Service
jest.mock("@/lib/email-sender", () => ({
  sendTemplateEmail: jest.fn(),
}));

jest.mock("@/lib/request-body-parser", () => {
  const actual = jest.requireActual("@/lib/request-body-parser");
  return {
    ...actual,
    parseJsonBody: jest.fn(async (req: Request) => req.json()),
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

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

jest.mock("@/lib/user-validation", () => ({
  validateEmail: jest.fn(() => ({ isValid: true })),
}));

const mockedPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
  };
  invitation: {
    updateMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
};

const mockedRequireAdmin = requireAdmin as jest.Mock;
const mockedSendTemplateEmail = sendTemplateEmail as jest.Mock;

describe("POST /api/admin/invitations - Unique active invitation per email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = "https://example.com";
    mockedRequireAdmin.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mockedSendTemplateEmail.mockResolvedValue(true);
    mockedPrisma.invitation.delete.mockResolvedValue({ id: "deleted-invitation" });
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("should invalidate old active invitations before creating a new one", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
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

    expect(mockedPrisma.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        usedAt: null,
        NOT: { id: "new-inv-123" },
      },
      data: {
        usedAt: expect.any(Date),
      },
    });

    expect(mockedPrisma.invitation.create).toHaveBeenCalled();
  });

  it("should handle email with existing active invitations", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
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
        NOT: { id: "new-inv-456" },
      },
      data: {
        usedAt: expect.any(Date),
      },
    });
  });

  it("should handle email with no existing active invitations", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
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

  it("should return 500 if invitation creation fails", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.invitation.create.mockRejectedValue(new Error("Create failed"));

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockedPrisma.invitation.updateMany).not.toHaveBeenCalled();
  });

  it("should return error if email sending fails", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.invitation.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.invitation.create.mockResolvedValue({
      id: "new-inv-111",
      email: "user@example.com",
      tokenHash: "hashed-new-token-111",
      expiresAt: new Date("2024-12-31T23:59:59Z"),
    });
    mockedSendTemplateEmail.mockRejectedValue(new Error("SMTP connection failed"));

    const request = new NextRequest("https://example.com/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    expect(mockedPrisma.invitation.delete).toHaveBeenCalledWith({
      where: { id: "new-inv-111" },
    });
  });

  it("should normalize email to lowercase and trim", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
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
        NOT: { id: "new-inv-222" },
      },
      data: {
        usedAt: expect.any(Date),
      },
    });
  });

  it("should include invitationId in email log context", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
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

    expect(mockedSendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "einladung-zur-rag-mse",
        to: "user@example.com",
        variables: expect.objectContaining({
          inviteUrl: expect.stringMatching(/^https:\/\/example\.com\/einladung\/.+$/),
        }),
      })
    );
    expect(logInfo).toHaveBeenCalledWith(
      "invitation_email_queued",
      expect.any(String),
      expect.objectContaining({
        invitationId: "inv-with-id",
        route: "/api/admin/invitations",
        method: "POST",
        userEmail: "admin@example.com",
      })
    );
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

    expect(mockedPrisma.invitation.create).not.toHaveBeenCalled();
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

import { POST } from "@/app/api/admin/users/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { sendInvitationEmail } from "@/lib/invitations";
import { hash } from "bcryptjs";
import { validateCsrfHeaders } from "@/lib/api-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/invitations", () => ({
  generateInvitationToken: jest.fn(() => "invite-token-123"),
  hashInvitationToken: jest.fn((token: string) => `hashed-${token}`),
  getInvitationExpiryDate: jest.fn(() => new Date("2024-12-31T23:59:59Z")),
  buildInviteUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/einladung/${token}`),
  sendInvitationEmail: jest.fn(),
}));

jest.mock("@/lib/crypto-utils", () => ({
  generateRandomPassword: jest.fn(() => "random-password-123"),
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
  withApiErrorHandling: jest.fn((handler: unknown) => handler),
}));

jest.mock("@/lib/user-validation", () => ({
  validateEmail: jest.fn(() => true),
  validateName: jest.fn(() => ({ isValid: true, error: null })),
  validateAddress: jest.fn(() => ({ isValid: true, error: null })),
  validatePhone: jest.fn(() => ({ isValid: true, error: null })),
  validateRank: jest.fn(() => ({ isValid: true, error: null })),
  validatePk: jest.fn(() => ({ isValid: true, error: null })),
  validateReservistsAssociation: jest.fn(() => ({ isValid: true, error: null })),
  validateAssociationMemberNumber: jest.fn(() => ({ isValid: true, error: null })),
  normalizeOptionalField: jest.fn((val) => (val === null || val === "" || val === undefined ? null : val)),
}));

jest.mock("@/lib/validation-schema", () => ({
  validateRole: jest.fn(() => true),
  validateDateString: jest.fn(() => true),
}));

jest.mock("@/lib/logger", () => ({
  logValidationFailure: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

const mockedPrisma = prisma as {
  user: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockedRequireAdmin = requireAdmin as jest.Mock;
const mockedSendInvitationEmail = sendInvitationEmail as jest.Mock;
const mockedHash = hash as jest.Mock;

describe("POST /api/admin/users - User creation with transaction", () => {
  const mockAdmin = {
    id: "admin-1",
    email: "admin@example.com",
  };

  const mockNewUser = {
    id: "user-123",
    email: "user@example.com",
    name: "Test User",
    role: "MEMBER",
    address: null,
    phone: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    memberSince: null,
    dateOfBirth: null,
    rank: null,
    pk: null,
    reservistsAssociation: null,
    associationMemberNumber: null,
    hasPossessionCard: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = "https://example.com";
    mockedRequireAdmin.mockResolvedValue(mockAdmin);
    mockedSendInvitationEmail.mockResolvedValue({ success: true });
    mockedHash.mockResolvedValue("hashed-password-123");
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("should create user and invitation in a transaction", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const mockTx = {
      user: {
        create: jest.fn().mockResolvedValue(mockNewUser),
      },
      invitation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("user-123");
    expect(data.email).toBe("user@example.com");

    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });

  it("should ensure both user and invitation are created atomically", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    
    let userCreated = false;
    let invitationCreated = false;
    const mockTx = {
      user: {
        create: jest.fn().mockImplementation(() => {
          userCreated = true;
          return mockNewUser;
        }),
      },
      invitation: {
        create: jest.fn().mockImplementation(() => {
          invitationCreated = true;
          return { id: "inv-123" };
        }),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(userCreated).toBe(true);
    expect(invitationCreated).toBe(true);
    expect(mockTx.user.create).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        password: "hashed-password-123",
        name: "Test User",
        role: "MEMBER",
        address: null,
        phone: null,
        memberSince: null,
        dateOfBirth: null,
        rank: null,
        pk: null,
        reservistsAssociation: null,
        associationMemberNumber: null,
        hasPossessionCard: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        address: true,
        phone: true,
        memberSince: true,
        dateOfBirth: true,
        rank: true,
        pk: true,
        reservistsAssociation: true,
        associationMemberNumber: true,
        hasPossessionCard: true,
        createdAt: true,
      },
    });
  });

  it("should rollback transaction if invitation creation fails", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        user: {
          create: jest.fn().mockResolvedValue(mockNewUser),
        },
      invitation: {
        create: jest.fn().mockRejectedValue(new Error("Database constraint violation")),
        updateMany: jest.fn(),
      },
      };
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    await expect(POST(request)).rejects.toThrow("Database constraint violation");
  });

  it("should normalize email to lowercase and trim", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const mockTx = {
      user: {
        create: jest.fn().mockResolvedValue(mockNewUser),
      },
      invitation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "  USER@EXAMPLE.COM  ",
        name: "Test User",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockedHash).toHaveBeenCalledWith("random-password-123", 10);
  });

  it("should create admin user when role is specified", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });

    const mockTx = {
      user: {
        create: jest.fn().mockResolvedValue({
          ...mockNewUser,
          role: "ADMIN",
        }),
      },
      invitation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        name: "Admin User",
        role: "ADMIN",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockTx.user.create).toHaveBeenCalled();
  });

  it("should include optional fields when provided", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockedPrisma);
    });

    const mockTx = {
      user: {
        create: jest.fn().mockResolvedValue({
          ...mockNewUser,
          address: "Musterstraße 123",
          phone: "+49 123 456789",
        }),
      },
      invitation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
        address: "Musterstraße 123",
        phone: "+49 123 456789",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("should return 409 if user already exists", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "existing-123",
      email: "user@example.com",
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Ein Benutzer mit dieser E-Mail existiert bereits");
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("should send invitation email after successful transaction", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const mockTx = {
      user: {
        create: jest.fn().mockResolvedValue(mockNewUser),
      },
      invitation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockedSendInvitationEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      inviteUrl: "https://example.com/einladung/invite-token-123",
      logContext: {
        route: "/api/admin/users",
        method: "POST",
        userId: "user-123",
        userEmail: "admin@example.com",
      },
    });
  });

  it("should not affect transaction if email sending fails", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const mockTx = {
      user: {
        create: jest.fn().mockResolvedValue(mockNewUser),
      },
      invitation: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });
    mockedSendInvitationEmail.mockResolvedValue({
      success: false,
      error: new Error("SMTP connection failed"),
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });

  it("should return 500 if APP_URL is not configured", async () => {
    delete process.env.APP_URL;

    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    await expect(POST(request)).rejects.toThrow("APP_URL ist nicht konfiguriert");
  });

  it("should validate CSRF headers", async () => {
    validateCsrfHeaders.mockImplementationOnce(() => {
      throw new Error("Invalid CSRF token");
    });

    const request = new NextRequest("https://example.com/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        name: "Test User",
      }),
    });

    await expect(POST(request)).rejects.toThrow("Invalid CSRF token");
    expect(validateCsrfHeaders).toHaveBeenCalledWith(request);
  });
});

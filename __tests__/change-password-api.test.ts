import { PUT } from "@/app/api/user/change-password/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { compare, hash } from "bcryptjs";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-utils", () => {
  const actual = jest.requireActual("@/lib/auth-utils");
  return {
    ...actual,
    requireMember: jest.fn(),
  };
});

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
  maskEmail: jest.fn((email: string) => email),
}));

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
    parseJsonBody: jest.fn(async (req: Request) => req.json()),
    validateCsrfHeaders: jest.fn(),
  };
});

function createMockRequest(body: Record<string, unknown>) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as NextRequest;
}

const member = { id: "user-1", email: "member@example.com", role: "MEMBER", name: "Mitglied" };

describe("PUT /api/user/change-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMember as jest.Mock).mockResolvedValue(member);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ password: "stored-hash" });
    (compare as jest.Mock).mockResolvedValue(true);
    (hash as jest.Mock).mockResolvedValue("new-hash");
  });

  it("returns 401 when not logged in", async () => {
    const { UnauthorizedError } = jest.requireActual("@/lib/auth-utils");
    (requireMember as jest.Mock).mockRejectedValue(new UnauthorizedError());

    const response = await PUT(createMockRequest({
      currentPassword: "AltesPasswort1",
      newPassword: "NeuesPasswort1",
      confirmPassword: "NeuesPasswort1",
    }));

    expect(response.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password with 400", async () => {
    (compare as jest.Mock).mockResolvedValue(false);

    const response = await PUT(createMockRequest({
      currentPassword: "Falsch12345",
      newPassword: "NeuesPasswort1",
      confirmPassword: "NeuesPasswort1",
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Aktuelles Passwort ist falsch");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a new password that fails the password policy", async () => {
    const response = await PUT(createMockRequest({
      currentPassword: "AltesPasswort1",
      newPassword: "kurz",
      confirmPassword: "kurz",
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects mismatching confirmation", async () => {
    const response = await PUT(createMockRequest({
      currentPassword: "AltesPasswort1",
      newPassword: "NeuesPasswort1",
      confirmPassword: "AnderesPasswort1",
    }));

    expect(response.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("hashes and stores the new password on success", async () => {
    const response = await PUT(createMockRequest({
      currentPassword: "AltesPasswort1",
      newPassword: "NeuesPasswort1",
      confirmPassword: "NeuesPasswort1",
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Passwort wurde erfolgreich geändert");
    expect(compare).toHaveBeenCalledWith("AltesPasswort1", "stored-hash");
    expect(hash).toHaveBeenCalledWith("NeuesPasswort1", 10);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ password: "new-hash" }),
      })
    );
  });
});

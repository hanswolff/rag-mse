import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/admin/users/[id]/route";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => ({
  parseJsonBody: jest.fn(async (req: NextRequest) => req.json()),
  withApiErrorHandling: jest.fn((handler: unknown) => handler),
  validateCsrfHeaders: jest.fn(),
  validateRequestBody: jest.fn(() => ({ isValid: true, errors: [] })),
}));

jest.mock("@/lib/audit-log", () => ({
  logAdminAction: jest.fn(),
}));

jest.mock("@/lib/role-change-email", () => ({
  sendRoleChangeEmail: jest.fn().mockResolvedValue(undefined),
}));

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks normal admins from editing the site administrator", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "site-admin-1",
      role: "SITE_ADMINISTRATOR",
      email: "site-admin@example.com",
    });

    const request = new NextRequest("http://localhost:3000/api/admin/users/site-admin-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Neuer Name" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "site-admin-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("nur vom SiteAdministrator");
  });

  it("returns 404 for a non-existent user", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/users/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Egal" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "missing" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Benutzer nicht gefunden");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 409 when changing to an email that already exists", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user-1", role: "MEMBER", email: "alt@example.com" })
      .mockResolvedValueOnce({ id: "user-2", role: "MEMBER", email: "belegt@example.com" });

    const request = new NextRequest("http://localhost:3000/api/admin/users/user-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "Belegt@Example.com" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "user-1" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Ein Benutzer mit dieser E-Mail existiert bereits");
    // Duplikatprüfung muss mit der normalisierten (kleingeschriebenen) E-Mail laufen
    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { email: "belegt@example.com" } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates name/email with normalization and returns the updated user", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user-1", role: "MEMBER", email: "alt@example.com" })
      .mockResolvedValueOnce(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "neu@example.com",
      name: "Neuer Name",
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
      adminNotes: null,
      createdAt: new Date("2026-01-01"),
    });

    const request = new NextRequest("http://localhost:3000/api/admin/users/user-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "  Neu@Example.com ", name: "  Neuer Name  " }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "user-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toBe("neu@example.com");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { email: "neu@example.com", name: "Neuer Name" },
      })
    );
  });

  it("blocks demoting the last remaining admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "site-admin", role: "SITE_ADMINISTRATOR" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: "ADMIN" }),
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn(),
        },
      })
    );

    const request = new NextRequest("http://localhost:3000/api/admin/users/admin-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "MEMBER" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "admin-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Der letzte Administrator darf nicht herabgestuft werden");
  });

  it("rejects assigning the SITE_ADMINISTRATOR role", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "site-admin", role: "SITE_ADMINISTRATOR" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      role: "MEMBER",
      email: "user@example.com",
    });

    const request = new NextRequest("http://localhost:3000/api/admin/users/user-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "SITE_ADMINISTRATOR" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "user-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Die Rolle SiteAdministrator darf nicht vergeben werden");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

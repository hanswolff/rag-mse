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
});

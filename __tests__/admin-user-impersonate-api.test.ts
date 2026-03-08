import { POST } from "@/app/api/admin/users/[id]/impersonate/route";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth-utils", () => ({
  requireAuth: jest.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = "Keine Berechtigung") {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe("POST /api/admin/users/[id]/impersonate", () => {
  const mockRequireAuth = requireAuth as jest.Mock;
  const mockFindUnique = prisma.user.findUnique as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "this-is-a-test-secret-with-32-plus-chars";
  });

  it("returns a proof for site administrators", async () => {
    mockRequireAuth.mockResolvedValue({ id: "site-admin-1", role: "SITE_ADMINISTRATOR", isImpersonating: false });
    mockFindUnique.mockResolvedValue({
      id: "member-1",
      name: "Mitglied",
      email: "mitglied@example.com",
      role: "MEMBER",
    });

    const response = await POST(new Request("http://localhost:3000/api/admin/users/member-1/impersonate", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "member-1" }),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.proof).toBe("string");
    expect(body.target.id).toBe("member-1");
  });

  it("rejects self impersonation", async () => {
    mockRequireAuth.mockResolvedValue({ id: "site-admin-1", role: "SITE_ADMINISTRATOR", isImpersonating: false });

    const response = await POST(new Request("http://localhost:3000/api/admin/users/site-admin-1/impersonate", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "site-admin-1" }),
    } as never);

    expect(response.status).toBe(400);
  });

  it("rejects non-site-administrators", async () => {
    mockRequireAuth.mockResolvedValue({ id: "admin-1", role: "ADMIN", isImpersonating: false });

    const response = await POST(new Request("http://localhost:3000/api/admin/users/member-1/impersonate", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "member-1" }),
    } as never);

    expect(response.status).toBe(403);
  });
});

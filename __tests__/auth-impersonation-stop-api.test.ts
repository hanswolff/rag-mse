import { POST } from "@/app/api/auth/impersonation/stop/route";
import { requireAuth } from "@/lib/auth-utils";

jest.mock("@/lib/auth-utils", () => ({
  requireAuth: jest.fn(),
}));

describe("POST /api/auth/impersonation/stop", () => {
  const mockRequireAuth = requireAuth as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "this-is-a-test-secret-with-32-plus-chars";
  });

  it("returns a stop proof when impersonation is active", async () => {
    mockRequireAuth.mockResolvedValue({
      id: "member-1",
      role: "MEMBER",
      isImpersonating: true,
      impersonatedBy: {
        id: "site-admin-1",
        role: "SITE_ADMINISTRATOR",
        name: "Site Admin",
        email: "site@example.com",
      },
    });

    const response = await POST(new Request("http://localhost:3000/api/auth/impersonation/stop", { method: "POST" }) as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.proof).toBe("string");
  });

  it("returns 400 when no impersonation is active", async () => {
    mockRequireAuth.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isImpersonating: false,
      impersonatedBy: undefined,
    });

    const response = await POST(new Request("http://localhost:3000/api/auth/impersonation/stop", { method: "POST" }) as never);
    expect(response.status).toBe(400);
  });
});

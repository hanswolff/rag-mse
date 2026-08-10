import { Role } from "@prisma/client";
import {
  authorizeCredentials,
  createImpersonationStartProof,
  createImpersonationStopProof,
  createLoginProof,
  authOptions,
} from "@/lib/auth";
import { RateLimitUnavailableError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit, recordSuccessfulLogin } from "@/lib/rate-limiter";
import { shouldFailOpenOnRateLimiterError } from "@/lib/rate-limit-policy";
import { compare } from "bcryptjs";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkLoginRateLimit: jest.fn(),
  recordSuccessfulLogin: jest.fn(),
}));

jest.mock("@/lib/rate-limit-policy", () => ({
  shouldFailOpenOnRateLimiterError: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

describe("auth", () => {
  const mockPrismaUserFindUnique = prisma.user.findUnique as jest.Mock;
  const mockPrismaUserUpdate = prisma.user.update as jest.Mock;
  const mockCheckLoginRateLimit = checkLoginRateLimit as jest.Mock;
  const mockRecordSuccessfulLogin = recordSuccessfulLogin as jest.Mock;
  const mockShouldFailOpenOnRateLimiterError = shouldFailOpenOnRateLimiterError as jest.Mock;
  const mockCompare = compare as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "this-is-a-test-secret-with-32-plus-chars";
  });

  it("accepts a valid login proof and updates lastLoginAt", async () => {
    const req = {
      ip: "203.0.113.10",
      headers: {},
    };
    const email = "member@example.com";
    const password = "Secret123";

    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-1",
      email,
      name: "Member",
      role: Role.MEMBER,
      activatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const loginProof = createLoginProof(email, "203.0.113.10", password);
    const result = await authorizeCredentials({ email, password, loginProof }, req);

    expect(result).toEqual({
      id: "user-1",
      email,
      name: "Member",
      role: Role.MEMBER,
    });
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(mockCheckLoginRateLimit).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulLogin).toHaveBeenCalledWith("203.0.113.10", email);
  });

  it("rejects a non-activated account even with a valid password", async () => {
    mockCheckLoginRateLimit.mockResolvedValue({ allowed: true, attemptCount: 0 });
    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-3",
      email: "inaktiv@example.com",
      name: "Inaktives Mitglied",
      role: Role.MEMBER,
      password: "hashed-password",
      activatedAt: null,
    });
    mockCompare.mockResolvedValue(true);

    const result = await authorizeCredentials(
      { email: "inaktiv@example.com", password: "Secret123" },
      { ip: "203.0.113.30", headers: {} }
    );

    expect(result).toBeNull();
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
    expect(mockRecordSuccessfulLogin).not.toHaveBeenCalled();
  });

  it("rejects a valid login proof for a non-activated account", async () => {
    const email = "inaktiv@example.com";
    const password = "Secret123";
    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-3",
      email,
      name: "Inaktives Mitglied",
      role: Role.MEMBER,
      activatedAt: null,
    });

    const loginProof = createLoginProof(email, "203.0.113.31", password);
    const result = await authorizeCredentials({ email, password, loginProof }, {
      ip: "203.0.113.31",
      headers: {},
    });

    expect(result).toBeNull();
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
  });

  it("activates a site administrator on first login instead of rejecting", async () => {
    mockCheckLoginRateLimit.mockResolvedValue({ allowed: true, attemptCount: 0 });
    mockPrismaUserFindUnique.mockResolvedValue({
      id: "site-1",
      email: "site@example.com",
      name: "Site Admin",
      role: Role.SITE_ADMINISTRATOR,
      password: "hashed-password",
      activatedAt: null,
    });
    mockCompare.mockResolvedValue(true);

    const result = await authorizeCredentials(
      { email: "site@example.com", password: "Secret123" },
      { ip: "203.0.113.32", headers: {} }
    );

    expect(result).toEqual({
      id: "site-1",
      email: "site@example.com",
      name: "Site Admin",
      role: Role.SITE_ADMINISTRATOR,
    });
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: { lastLoginAt: expect.any(Date), activatedAt: expect.any(Date) },
    });
  });

  it("blocks login when rate limiter is unavailable and fail-open is disabled", async () => {
    mockCheckLoginRateLimit.mockRejectedValue(new Error("redis unavailable"));
    mockShouldFailOpenOnRateLimiterError.mockReturnValue(false);

    await expect(
      authorizeCredentials(
        {
          email: "member@example.com",
          password: "Secret123",
        },
        { ip: "203.0.113.20", headers: {} }
      )
    ).rejects.toThrow(RateLimitUnavailableError);
  });

  it("continues login when rate limiter is unavailable and fail-open is enabled", async () => {
    mockCheckLoginRateLimit.mockRejectedValue(new Error("redis unavailable"));
    mockShouldFailOpenOnRateLimiterError.mockReturnValue(true);
    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-2",
      email: "member2@example.com",
      name: "Member 2",
      role: Role.ADMIN,
      password: "hashed-password",
      activatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    mockCompare.mockResolvedValue(true);

    const result = await authorizeCredentials(
      {
        email: "member2@example.com",
        password: "Secret123",
      },
      { ip: "203.0.113.21", headers: {} }
    );

    expect(result).toEqual({
      id: "user-2",
      email: "member2@example.com",
      name: "Member 2",
      role: Role.ADMIN,
    });
    expect(mockRecordSuccessfulLogin).toHaveBeenCalledWith("203.0.113.21", "member2@example.com");
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it("starts impersonation in jwt callback with valid start proof", async () => {
    mockPrismaUserFindUnique
      .mockResolvedValueOnce({ role: Role.SITE_ADMINISTRATOR, name: "Site Admin" })
      .mockResolvedValueOnce({
        id: "target-1",
        email: "member@example.com",
        name: "Member",
        role: Role.MEMBER,
      });

    const jwtCallback = authOptions.callbacks?.jwt;
    expect(jwtCallback).toBeDefined();

    const proof = createImpersonationStartProof("actor-1", "target-1");
    const result = await jwtCallback!({
      token: {
        id: "actor-1",
        role: Role.SITE_ADMINISTRATOR,
        name: "Site Admin",
        email: "site@example.com",
      } as never,
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: { impersonationStartProof: proof },
    });

    expect(result.id).toBe("target-1");
    expect(result.role).toBe(Role.MEMBER);
    expect((result as { impersonatedById?: string }).impersonatedById).toBe("actor-1");
  });

  it("stops impersonation in jwt callback with valid stop proof", async () => {
    mockPrismaUserFindUnique
      .mockResolvedValueOnce({ role: Role.MEMBER, name: "Member" })
      .mockResolvedValueOnce({
        id: "actor-1",
        email: "site@example.com",
        name: "Site Admin",
        role: Role.SITE_ADMINISTRATOR,
      });

    const jwtCallback = authOptions.callbacks?.jwt;
    expect(jwtCallback).toBeDefined();

    const proof = createImpersonationStopProof("actor-1", "target-1");
    const result = await jwtCallback!({
      token: {
        id: "target-1",
        role: Role.MEMBER,
        name: "Member",
        email: "member@example.com",
        impersonatedById: "actor-1",
        impersonatedByRole: Role.SITE_ADMINISTRATOR,
        impersonatedByName: "Site Admin",
        impersonatedByEmail: "site@example.com",
      } as never,
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: { impersonationStopProof: proof },
    });

    expect(result.id).toBe("actor-1");
    expect(result.role).toBe(Role.SITE_ADMINISTRATOR);
    expect((result as { impersonatedById?: string }).impersonatedById).toBeUndefined();
  });

  it("invalidates the token when the user no longer exists", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null);

    const jwtCallback = authOptions.callbacks?.jwt;
    const result = await jwtCallback!({
      token: {
        id: "deleted-user",
        sub: "deleted-user",
        role: Role.ADMIN,
        name: "Geloeschter Admin",
        email: "deleted@example.com",
      } as never,
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: undefined,
      isNewUser: false,
      session: undefined,
    });

    expect(result.id).toBeUndefined();
    expect(result.sub).toBeUndefined();
    expect(result.role).toBeUndefined();
  });

  it("returns no session when the token has no user id", async () => {
    const sessionCallback = authOptions.callbacks?.session;
    const result = await sessionCallback!({
      session: {
        user: { id: "", role: "", name: "", email: "" },
        expires: new Date(Date.now() + 60000).toISOString(),
      } as never,
      token: {} as never,
      user: undefined as never,
      newSession: undefined,
      trigger: "update",
    });

    expect(result).toBeNull();
  });

  it("invalidates the token when the impersonation actor was deleted before stop", async () => {
    mockPrismaUserFindUnique
      .mockResolvedValueOnce({ role: Role.MEMBER, name: "Member" })
      .mockResolvedValueOnce(null);

    const jwtCallback = authOptions.callbacks?.jwt;
    const proof = createImpersonationStopProof("actor-1", "target-1");
    const result = await jwtCallback!({
      token: {
        id: "target-1",
        sub: "target-1",
        role: Role.MEMBER,
        name: "Member",
        email: "member@example.com",
        impersonatedById: "actor-1",
        impersonatedByRole: Role.SITE_ADMINISTRATOR,
        impersonatedByName: "Site Admin",
        impersonatedByEmail: "site@example.com",
      } as never,
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: { impersonationStopProof: proof },
    });

    expect(result.id).toBeUndefined();
    expect(result.role).toBeUndefined();
    expect((result as { impersonatedById?: string }).impersonatedById).toBeUndefined();
  });
});

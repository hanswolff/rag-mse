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
      user: undefined,
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
      user: undefined,
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
});

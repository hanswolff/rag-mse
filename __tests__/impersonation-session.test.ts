import { Role } from "@prisma/client";
import {
  applyImpersonationStart,
  applyImpersonationStop,
  readImpersonationProofs,
} from "@/lib/impersonation-session";
import { createImpersonationStartProof, createImpersonationStopProof } from "@/lib/auth-proof";
import { prisma } from "@/lib/prisma";
import type { JWT } from "next-auth/jwt";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

describe("impersonation-session", () => {
  const mockPrismaUserFindUnique = prisma.user.findUnique as jest.Mock;

  const siteAdminToken = (): JWT =>
    ({
      id: "actor-1",
      role: Role.SITE_ADMINISTRATOR,
      name: "Site Admin",
      email: "site@example.com",
    }) as JWT;

  const impersonatingToken = (): JWT =>
    ({
      id: "target-1",
      role: Role.MEMBER,
      name: "Member",
      email: "member@example.com",
      impersonatedById: "actor-1",
      impersonatedByRole: Role.SITE_ADMINISTRATOR,
      impersonatedByName: "Site Admin",
      impersonatedByEmail: "site@example.com",
    }) as JWT;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "this-is-a-test-secret-with-32-plus-chars";
  });

  describe("readImpersonationProofs", () => {
    it("extracts both proofs from the update payload", () => {
      expect(
        readImpersonationProofs({ impersonationStartProof: "start-proof", impersonationStopProof: "stop-proof" })
      ).toEqual({ impersonationStartProof: "start-proof", impersonationStopProof: "stop-proof" });
    });

    it("returns empty strings for missing or non-string values", () => {
      expect(readImpersonationProofs(undefined)).toEqual({
        impersonationStartProof: "",
        impersonationStopProof: "",
      });
      expect(readImpersonationProofs({ impersonationStartProof: 42 })).toEqual({
        impersonationStartProof: "",
        impersonationStopProof: "",
      });
    });
  });

  describe("applyImpersonationStart", () => {
    it("switches the token to the target user with a valid start proof", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        id: "target-1",
        email: "member@example.com",
        name: "Member",
        role: Role.MEMBER,
      });

      const proof = createImpersonationStartProof("actor-1", "target-1");
      const result = await applyImpersonationStart(siteAdminToken(), proof);

      expect(result.id).toBe("target-1");
      expect(result.role).toBe(Role.MEMBER);
      expect(result.name).toBe("Member");
      expect(result.email).toBe("member@example.com");
      expect(result.impersonatedById).toBe("actor-1");
      expect(result.impersonatedByRole).toBe(Role.SITE_ADMINISTRATOR);
      expect(result.impersonatedByName).toBe("Site Admin");
      expect(result.impersonatedByEmail).toBe("site@example.com");
    });

    it("passes the token through unchanged for an invalid proof", async () => {
      const token = siteAdminToken();
      const result = await applyImpersonationStart(token, "not-a-valid-proof");

      expect(result).toEqual(siteAdminToken());
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });

    it("rejects a valid proof when the token is not a site administrator", async () => {
      const token = { ...siteAdminToken(), role: Role.ADMIN } as JWT;
      const proof = createImpersonationStartProof("actor-1", "target-1");
      const result = await applyImpersonationStart(token, proof);

      expect(result.id).toBe("actor-1");
      expect(result.role).toBe(Role.ADMIN);
      expect(result.impersonatedById).toBeUndefined();
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });

    it("rejects a start while already impersonating", async () => {
      const token = impersonatingToken();
      const proof = createImpersonationStartProof("target-1", "target-2");
      const result = await applyImpersonationStart(token, proof);

      expect(result).toEqual(impersonatingToken());
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });

    it("rejects self-impersonation", async () => {
      const proof = createImpersonationStartProof("actor-1", "actor-1");
      const result = await applyImpersonationStart(siteAdminToken(), proof);

      expect(result).toEqual(siteAdminToken());
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });

    it("passes the token through when the target user no longer exists", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const proof = createImpersonationStartProof("actor-1", "target-1");
      const result = await applyImpersonationStart(siteAdminToken(), proof);

      expect(result).toEqual(siteAdminToken());
    });
  });

  describe("applyImpersonationStop", () => {
    it("restores the original actor with a valid stop proof", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({
        id: "actor-1",
        email: "site@example.com",
        name: "Site Admin",
        role: Role.SITE_ADMINISTRATOR,
      });

      const proof = createImpersonationStopProof("actor-1", "target-1");
      const result = await applyImpersonationStop(impersonatingToken(), proof);

      expect(result.id).toBe("actor-1");
      expect(result.role).toBe(Role.SITE_ADMINISTRATOR);
      expect(result.name).toBe("Site Admin");
      expect(result.email).toBe("site@example.com");
      expect(result.impersonatedById).toBeUndefined();
      expect(result.impersonatedByRole).toBeUndefined();
      expect(result.impersonatedByName).toBeUndefined();
      expect(result.impersonatedByEmail).toBeUndefined();
    });

    it("passes the token through unchanged for an invalid stop proof", async () => {
      const result = await applyImpersonationStop(impersonatingToken(), "not-a-valid-proof");

      expect(result).toEqual(impersonatingToken());
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });

    it("passes the token through when no impersonation is active", async () => {
      const proof = createImpersonationStopProof("actor-1", "actor-1");
      const result = await applyImpersonationStop(siteAdminToken(), proof);

      expect(result).toEqual(siteAdminToken());
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });

    it("invalidates the token when the original actor was deleted", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const proof = createImpersonationStopProof("actor-1", "target-1");
      const result = await applyImpersonationStop(impersonatingToken(), proof);

      expect(result.id).toBeUndefined();
      expect(result.role).toBeUndefined();
      expect(result.impersonatedById).toBeUndefined();
    });
  });
});

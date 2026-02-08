import { validateRole, VALID_ROLES } from "@/lib/validation-schema";

describe("validateRole", () => {
  describe("valid roles", () => {
    it("should accept ADMIN role", () => {
      expect(validateRole("ADMIN")).toBe(true);
    });

    it("should accept MEMBER role", () => {
      expect(validateRole("MEMBER")).toBe(true);
    });

    it("should accept all defined VALID_ROLES", () => {
      VALID_ROLES.forEach(role => {
        expect(validateRole(role)).toBe(true);
      });
    });
  });

  describe("invalid roles", () => {
    it("should reject lowercase admin", () => {
      expect(validateRole("admin")).toBe(false);
    });

    it("should reject lowercase member", () => {
      expect(validateRole("member")).toBe(false);
    });

    it("should reject mixed case roles", () => {
      expect(validateRole("Admin")).toBe(false);
      expect(validateRole("Member")).toBe(false);
      expect(validateRole("aDmIn")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(validateRole("")).toBe(false);
    });

    it("should reject whitespace-only string", () => {
      expect(validateRole("   ")).toBe(false);
    });

    it("should reject non-existent role", () => {
      expect(validateRole("SUPERADMIN")).toBe(false);
      expect(validateRole("MODERATOR")).toBe(false);
      expect(validateRole("GUEST")).toBe(false);
      expect(validateRole("USER")).toBe(false);
    });

    it("should reject role with spaces", () => {
      expect(validateRole(" ADMIN")).toBe(false);
      expect(validateRole("ADMIN ")).toBe(false);
      expect(validateRole(" ADMIN ")).toBe(false);
    });

    it("should reject role with extra characters", () => {
      expect(validateRole("ADMINX")).toBe(false);
      expect(validateRole("MEMBER1")).toBe(false);
      expect(validateRole("ADMIN!")).toBe(false);
    });
  });

  describe("type safety", () => {
    it("should reject null", () => {
      expect(validateRole(null as unknown as string)).toBe(false);
    });

    it("should reject undefined", () => {
      expect(validateRole(undefined as unknown as string)).toBe(false);
    });

    it("should reject number", () => {
      expect(validateRole(123 as unknown as string)).toBe(false);
      expect(validateRole(0 as unknown as string)).toBe(false);
    });

    it("should reject boolean", () => {
      expect(validateRole(true as unknown as string)).toBe(false);
      expect(validateRole(false as unknown as string)).toBe(false);
    });

    it("should reject object", () => {
      expect(validateRole({} as unknown as string)).toBe(false);
      expect(validateRole({ role: "ADMIN" } as unknown as string)).toBe(false);
    });

    it("should reject array", () => {
      expect(validateRole([] as unknown as string)).toBe(false);
      expect(validateRole(["ADMIN"] as unknown as string)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should reject role with special characters", () => {
      expect(validateRole("ADMIN@")).toBe(false);
      expect(validateRole("ADMIN#")).toBe(false);
      expect(validateRole("ADMIN$")).toBe(false);
      expect(validateRole("ADMIN%")).toBe(false);
      expect(validateRole("ADMIN-")).toBe(false);
      expect(validateRole("ADMIN_")).toBe(false);
    });

    it("should reject role with unicode characters", () => {
      expect(validateRole("ÄDMIN")).toBe(false);
      expect(validateRole("ADMINß")).toBe(false);
    });
  });
});

describe("VALID_ROLES constant", () => {
  it("should be an array", () => {
    expect(Array.isArray(VALID_ROLES)).toBe(true);
  });

  it("should contain exactly two roles", () => {
    expect(VALID_ROLES).toHaveLength(2);
  });

  it("should contain ADMIN", () => {
    expect(VALID_ROLES).toContain("ADMIN");
  });

  it("should contain MEMBER", () => {
    expect(VALID_ROLES).toContain("MEMBER");
  });
});

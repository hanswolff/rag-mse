import {
  canManageAdminArea,
  canAccessMemberArea,
} from "../lib/role-utils";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../lib/auth-utils";
import {
  sanitizeReturnUrl,
  buildLoginUrlWithReturnUrl,
} from "../lib/return-url";
import { Role } from "@prisma/client";

describe("auth-utils", () => {
  describe("canManageAdminArea", () => {
    it("should return true for admin user", () => {
      const user = { role: "ADMIN" as Role };
      expect(canManageAdminArea(user)).toBe(true);
    });

    it("should return true for site administrator user", () => {
      const user = { role: "SITE_ADMINISTRATOR" as Role };
      expect(canManageAdminArea(user)).toBe(true);
    });

    it("should return false for member user", () => {
      const user = { role: "MEMBER" as Role };
      expect(canManageAdminArea(user)).toBe(false);
    });

    it("should return false for null user", () => {
      expect(canManageAdminArea(null)).toBe(false);
    });

    it("should return false for undefined user", () => {
      expect(canManageAdminArea(undefined)).toBe(false);
    });

    it("should return false for user without role", () => {
      const user = {};
      expect(canManageAdminArea(user)).toBe(false);
    });
  });

  describe("canAccessMemberArea", () => {
    it("should return true for admin user", () => {
      const user = { role: "ADMIN" as Role };
      expect(canAccessMemberArea(user)).toBe(true);
    });

    it("should return true for site administrator user", () => {
      const user = { role: "SITE_ADMINISTRATOR" as Role };
      expect(canAccessMemberArea(user)).toBe(true);
    });

    it("should return true for auditor user", () => {
      const user = { role: "AUDITOR" as Role };
      expect(canAccessMemberArea(user)).toBe(true);
    });

    it("should return true for member user", () => {
      const user = { role: "MEMBER" as Role };
      expect(canAccessMemberArea(user)).toBe(true);
    });

    it("should return false for null user", () => {
      expect(canAccessMemberArea(null)).toBe(false);
    });

    it("should return false for undefined user", () => {
      expect(canAccessMemberArea(undefined)).toBe(false);
    });

    it("should return false for user without role", () => {
      const user = {};
      expect(canAccessMemberArea(user)).toBe(false);
    });
  });

  describe("UnauthorizedError", () => {
    it("should create error with default message", () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe("Nicht autorisiert");
      expect(error.name).toBe("UnauthorizedError");
    });

    it("should create error with custom message", () => {
      const error = new UnauthorizedError("Custom message");
      expect(error.message).toBe("Custom message");
      expect(error.name).toBe("UnauthorizedError");
    });
  });

  describe("ForbiddenError", () => {
    it("should create error with default message", () => {
      const error = new ForbiddenError();
      expect(error.message).toBe("Keine Berechtigung");
      expect(error.name).toBe("ForbiddenError");
    });

    it("should create error with custom message", () => {
      const error = new ForbiddenError("Custom message");
      expect(error.message).toBe("Custom message");
      expect(error.name).toBe("ForbiddenError");
    });
  });

  describe("returnUrl helpers", () => {
    it("accepts relative returnUrl on same origin", () => {
      expect(sanitizeReturnUrl("/profil?tab=kontakt", "http://localhost:3000")).toBe("/profil?tab=kontakt");
    });

    it("accepts absolute returnUrl when origin matches", () => {
      expect(sanitizeReturnUrl("http://localhost:3000/admin/dashboard", "http://localhost:3000")).toBe("/admin/dashboard");
    });

    it("rejects returnUrl with different origin", () => {
      expect(sanitizeReturnUrl("https://evil.example/phish", "http://localhost:3000")).toBeNull();
    });

    it("rejects protocol-relative returnUrl", () => {
      expect(sanitizeReturnUrl("//evil.example/phish", "http://localhost:3000")).toBeNull();
    });

    it("rejects login returnUrl to avoid loops", () => {
      expect(sanitizeReturnUrl("/login", "http://localhost:3000")).toBeNull();
    });

    it("builds login URL with encoded returnUrl", () => {
      expect(buildLoginUrlWithReturnUrl("/admin/dashboard?tab=users")).toBe(
        "/login?returnUrl=%2Fadmin%2Fdashboard%3Ftab%3Dusers"
      );
    });

    it("builds plain login URL for unsafe returnUrl input", () => {
      expect(buildLoginUrlWithReturnUrl("https://evil.example")).toBe("/login");
    });
  });
});

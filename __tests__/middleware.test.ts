import { hasAdminRole, hasMemberRole } from "../lib/role-utils";
import { shouldRedirectToLogin } from "../lib/auth-utils";

describe("middleware helpers", () => {
  describe("hasAdminRole", () => {
    it("should return true for ADMIN role", () => {
      expect(hasAdminRole("ADMIN")).toBe(true);
    });

    it("should return false for MEMBER role", () => {
      expect(hasAdminRole("MEMBER")).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(hasAdminRole(undefined)).toBe(false);
    });

    it("should return false for no role provided", () => {
      expect(hasAdminRole()).toBe(false);
    });
  });

  describe("hasMemberRole", () => {
    it("should return true for ADMIN role", () => {
      expect(hasMemberRole("ADMIN")).toBe(true);
    });

    it("should return true for MEMBER role", () => {
      expect(hasMemberRole("MEMBER")).toBe(true);
    });

    it("should return false for undefined role", () => {
      expect(hasMemberRole(undefined)).toBe(false);
    });

    it("should return false for no role provided", () => {
      expect(hasMemberRole()).toBe(false);
    });
  });

  describe("shouldRedirectToLogin", () => {
    it("should redirect to login when accessing admin without admin role", () => {
      expect(shouldRedirectToLogin("/admin", undefined)).toBe(true);
      expect(shouldRedirectToLogin("/admin", "MEMBER")).toBe(true);
    });

    it("should not redirect to login when accessing admin with admin role", () => {
      expect(shouldRedirectToLogin("/admin", "ADMIN")).toBe(false);
    });

    it("should redirect to login when accessing profil without member role", () => {
      expect(shouldRedirectToLogin("/profil", undefined)).toBe(true);
    });

    it("should not redirect to login when accessing profil with member role", () => {
      expect(shouldRedirectToLogin("/profil", "MEMBER")).toBe(false);
    });

    it("should not redirect to login when accessing profil with admin role", () => {
      expect(shouldRedirectToLogin("/profil", "ADMIN")).toBe(false);
    });

    it("should redirect to login when accessing passwort-aendern without member role", () => {
      expect(shouldRedirectToLogin("/passwort-aendern", undefined)).toBe(true);
    });

    it("should not redirect to login when accessing passwort-aendern with member role", () => {
      expect(shouldRedirectToLogin("/passwort-aendern", "MEMBER")).toBe(false);
    });

    it("should not redirect to login when accessing passwort-aendern with admin role", () => {
      expect(shouldRedirectToLogin("/passwort-aendern", "ADMIN")).toBe(false);
    });

    it("should not redirect to login when accessing termine (public route)", () => {
      expect(shouldRedirectToLogin("/termine", undefined)).toBe(false);
      expect(shouldRedirectToLogin("/termine", "MEMBER")).toBe(false);
      expect(shouldRedirectToLogin("/termine", "ADMIN")).toBe(false);
    });

    it("should not redirect to login when accessing public routes", () => {
      expect(shouldRedirectToLogin("/", undefined)).toBe(false);
      expect(shouldRedirectToLogin("/news", undefined)).toBe(false);
      expect(shouldRedirectToLogin("/kontakt", undefined)).toBe(false);
    });

    it("should not redirect to login when accessing admin sub-paths with admin role", () => {
      expect(shouldRedirectToLogin("/admin/users", "ADMIN")).toBe(false);
      expect(shouldRedirectToLogin("/admin/events", "ADMIN")).toBe(false);
    });

    it("should redirect to login when accessing admin sub-paths without admin role", () => {
      expect(shouldRedirectToLogin("/admin/users", undefined)).toBe(true);
      expect(shouldRedirectToLogin("/admin/events", "MEMBER")).toBe(true);
    });

    it("should not redirect to login when accessing profil sub-paths with admin role", () => {
      expect(shouldRedirectToLogin("/profil/edit", "ADMIN")).toBe(false);
    });

    it("should redirect to login when accessing profil sub-paths without member role", () => {
      expect(shouldRedirectToLogin("/profil/edit", undefined)).toBe(true);
    });

    it("should redirect to login when accessing passwort-aendern sub-paths without member role", () => {
      expect(shouldRedirectToLogin("/passwort-aendern/security", undefined)).toBe(true);
    });

    it("should not redirect to login when accessing termine sub-paths (public routes)", () => {
      expect(shouldRedirectToLogin("/termine/123", undefined)).toBe(false);
      expect(shouldRedirectToLogin("/termine/123", "ADMIN")).toBe(false);
    });
  });
});

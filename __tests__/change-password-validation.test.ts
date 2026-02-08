import { validateChangePasswordRequest } from "../lib/user-validation";

describe("change-password-validation", () => {
  describe("validateChangePasswordRequest", () => {
    it("should return valid for complete valid request", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid for missing current password", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Aktuelles Passwort ist erforderlich");
    });

    it("should return invalid for missing new password", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "",
        confirmPassword: "",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Neues Passwort ist erforderlich");
    });

    it("should return invalid for weak new password", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "weak",
        confirmPassword: "weak",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return invalid when new password is the same as current", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "SamePass123",
        newPassword: "SamePass123",
        confirmPassword: "SamePass123",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Neues Passwort muss vom aktuellen Passwort abweichen");
    });

    it("should return invalid for new password without uppercase", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "newpass123",
        confirmPassword: "newpass123",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens einen Großbuchstaben enthalten");
    });

    it("should return invalid for new password without lowercase", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "NEWPASS123",
        confirmPassword: "NEWPASS123",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens einen Kleinbuchstaben enthalten");
    });

    it("should return invalid for new password without digit", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "NewPassword",
        confirmPassword: "NewPassword",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens eine Ziffer enthalten");
    });

    it("should return invalid for new password too short", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "Short1",
        confirmPassword: "Short1",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens 8 Zeichen lang sein");
    });

    it("should return valid for new password meeting all requirements", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "NewSecure456",
        confirmPassword: "NewSecure456",
      });

      expect(result.isValid).toBe(true);
    });

    it("should return invalid when passwords do not match", () => {
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "DifferentPass123",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Neues Passwort und Passwortbestätigung stimmen nicht überein");
    });

    it("should return invalid for new password longer than maximum length", () => {
      const longPassword = "A" + "b1".repeat(36) + "C"; // 73 characters
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: longPassword,
        confirmPassword: longPassword,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort darf maximal 72 Zeichen lang sein");
    });

    it("should accept new password exactly at maximum length", () => {
      const maxPassword = "A" + "b1".repeat(35) + "C"; // 72 characters
      const result = validateChangePasswordRequest({
        currentPassword: "OldPass123",
        newPassword: maxPassword,
        confirmPassword: maxPassword,
      });

      expect(result.isValid).toBe(true);
    });
  });
});

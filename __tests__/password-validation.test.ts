import { validatePassword, getPasswordRequirements } from "../lib/password-validation";

describe("password-validation", () => {
  describe("validatePassword", () => {
    it("should accept a valid password", () => {
      const result = validatePassword("Password1");
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject password shorter than 8 characters", () => {
      const result = validatePassword("Pass1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens 8 Zeichen lang sein");
    });

    it("should reject password without uppercase letter", () => {
      const result = validatePassword("password1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens einen Großbuchstaben enthalten");
    });

    it("should reject password without lowercase letter", () => {
      const result = validatePassword("PASSWORD1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens einen Kleinbuchstaben enthalten");
    });

    it("should reject password without digit", () => {
      const result = validatePassword("Password");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens eine Ziffer enthalten");
    });

    it("should return all errors for password that fails all requirements", () => {
      const result = validatePassword("!!!!!!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain("Passwort muss mindestens 8 Zeichen lang sein");
      expect(result.errors).toContain("Passwort muss mindestens einen Großbuchstaben enthalten");
      expect(result.errors).toContain("Passwort muss mindestens einen Kleinbuchstaben enthalten");
      expect(result.errors).toContain("Passwort muss mindestens eine Ziffer enthalten");
    });

    it("should accept password with exactly 8 characters", () => {
      const result = validatePassword("Passwor1");
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should accept complex password with special characters", () => {
      const result = validatePassword("Password!123");
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should be case sensitive for uppercase requirement", () => {
      const result = validatePassword("password1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens einen Großbuchstaben enthalten");
    });

    it("should be case sensitive for lowercase requirement", () => {
      const result = validatePassword("PASSWORD1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort muss mindestens einen Kleinbuchstaben enthalten");
    });

    it("should reject password longer than maximum length", () => {
      const longPassword = "A" + "b1".repeat(36) + "C"; // 73 characters
      const result = validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort darf maximal 72 Zeichen lang sein");
    });

    it("should accept password exactly at maximum length", () => {
      const maxPassword = "A" + "b1".repeat(35) + "C"; // 72 characters
      const result = validatePassword(maxPassword);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject password much longer than maximum length", () => {
      const veryLongPassword = "A" + "b1".repeat(100) + "C"; // 202 characters
      const result = validatePassword(veryLongPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort darf maximal 72 Zeichen lang sein");
    });
  });

  describe("getPasswordRequirements", () => {
    it("should return list of password requirements", () => {
      const requirements = getPasswordRequirements();
      expect(requirements).toEqual([
        "Mindestens 8 Zeichen",
        "Maximal 72 Zeichen",
        "Mindestens ein Großbuchstabe",
        "Mindestens ein Kleinbuchstabe",
        "Mindestens eine Ziffer",
      ]);
    });

    it("should return 5 requirements", () => {
      const requirements = getPasswordRequirements();
      expect(requirements).toHaveLength(5);
    });
  });
});

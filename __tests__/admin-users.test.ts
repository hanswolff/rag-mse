import { validateEmail, validateCreateUserRequest, validateAddress, validatePhone, normalizeOptionalField } from "../lib/user-validation";
import { Role } from "@prisma/client";

// Echte Endpunkt-Tests für PATCH /api/admin/users/[id] liegen in
// __tests__/admin-users-id-api.test.ts — hier wird nur lib/user-validation getestet.

describe("user-validation", () => {
  describe("normalizeOptionalField", () => {
    it("trims values and converts empty/whitespace/null/undefined to null", () => {
      expect(normalizeOptionalField("  Musterstraße 123  ")).toBe("Musterstraße 123");
      expect(normalizeOptionalField("Musterstraße 123, 12345 Musterstadt")).toBe("Musterstraße 123, 12345 Musterstadt");
      expect(normalizeOptionalField("")).toBeNull();
      expect(normalizeOptionalField("   ")).toBeNull();
      expect(normalizeOptionalField(null)).toBeNull();
      expect(normalizeOptionalField(undefined)).toBeNull();
    });
  });

  describe("validateAddress", () => {
    it("accepts addresses up to 200 characters", () => {
      expect(validateAddress("Musterstraße 123, 12345 Musterstadt").isValid).toBe(true);
      expect(validateAddress("A".repeat(200)).isValid).toBe(true);
    });

    it("rejects addresses over 200 characters", () => {
      const result = validateAddress("A".repeat(201));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Adresse darf maximal 200 Zeichen lang sein");
    });
  });

  describe("validatePhone", () => {
    it("accepts valid phone numbers", () => {
      ["0123456789", "+49 123 456789", "(0123) 456-789", "0123-456789", "012345678901234567890123456789"].forEach((phone) => {
        expect(validatePhone(phone).isValid).toBe(true);
      });
    });

    it("rejects invalid characters", () => {
      const result = validatePhone("0123-456-789a");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Telefonnummer enthält ungültige Zeichen");
    });

    it("rejects numbers over 30 characters", () => {
      const result = validatePhone("0123456789012345678901234567890");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Telefonnummer darf maximal 30 Zeichen lang sein");
    });
  });

  describe("validateEmail", () => {
    it("should return isValid true for valid email", () => {
      expect(validateEmail("test@example.com")).toEqual({ isValid: true });
      expect(validateEmail("user.name@domain.co.uk")).toEqual({ isValid: true });
    });

    it("should return isValid false with error for invalid email", () => {
      expect(validateEmail("invalid")).toEqual({ isValid: false, error: "Ungültiges E-Mail-Format" });
      expect(validateEmail("@example.com")).toEqual({ isValid: false, error: "Ungültiges E-Mail-Format" });
      expect(validateEmail("test@")).toEqual({ isValid: false, error: "Ungültiges E-Mail-Format" });
      expect(validateEmail("")).toEqual({ isValid: false, error: "E-Mail ist erforderlich" });
      expect(validateEmail("test example.com")).toEqual({ isValid: false, error: "Ungültiges E-Mail-Format" });
    });
  });

  describe("validateCreateUserRequest", () => {
    it("should return valid for complete valid request", () => {
      const result = validateCreateUserRequest({
        email: "test@example.com",
        password: "TestPass123",
        name: "Test User",
        role: Role.MEMBER,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid for missing email", () => {
      const result = validateCreateUserRequest({
        email: "",
        password: "TestPass123",
        name: "Test User",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("E-Mail ist erforderlich");
    });

    it("should return invalid for invalid email format", () => {
      const result = validateCreateUserRequest({
        email: "invalid-email",
        password: "TestPass123",
        name: "Test User",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültiges E-Mail-Format");
    });

    it("should return invalid for missing password", () => {
      const result = validateCreateUserRequest({
        email: "test@example.com",
        password: "",
        name: "Test User",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Passwort ist erforderlich");
    });

    it("should return invalid for weak password", () => {
      const result = validateCreateUserRequest({
        email: "test@example.com",
        password: "weak",
        name: "Test User",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return invalid for missing name", () => {
      const result = validateCreateUserRequest({
        email: "test@example.com",
        password: "TestPass123",
        name: "",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Name ist erforderlich");
    });

    it("should return invalid for invalid role", () => {
      const result = validateCreateUserRequest({
        email: "test@example.com",
        password: "TestPass123",
        name: "Test User",
        role: "INVALID" as Role,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ungültige Rolle");
    });

    it("should default role to MEMBER if not provided", () => {
      const result = validateCreateUserRequest({
        email: "test@example.com",
        password: "TestPass123",
        name: "Test User",
      });

      expect(result.isValid).toBe(true);
    });
  });
});

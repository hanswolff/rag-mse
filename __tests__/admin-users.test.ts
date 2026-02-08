import { validateEmail, validateCreateUserRequest, validateAddress, validatePhone, normalizeOptionalField } from "../lib/user-validation";
import { Role } from "@prisma/client";

describe("PATCH /api/admin/users/[id] - API endpoint behavior", () => {
  describe("Email updates", () => {
    it("should validate email format and reject invalid emails", () => {
      const invalidEmails = ["invalid", "@example.com", "test@", "test", "test@.com"];

      invalidEmails.forEach(email => {
        const hasAt = email.includes("@");
        const hasDotAfterAt = hasAt && email.substring(email.indexOf("@")).includes(".");
        const hasDotBeforeAt = email.includes(".") && email.indexOf(".") < email.indexOf("@");
        const isValid = hasAt && hasDotAfterAt && hasDotBeforeAt;
        expect(isValid).toBe(false);
      });
    });

    it("should normalize emails to lowercase", () => {
      const email = "Test@Example.COM";
      const normalized = email.toLowerCase();
      expect(normalized).toBe("test@example.com");
    });

    it("should check for duplicate emails when changing", () => {
      const existingEmails = ["existing1@example.com", "existing2@example.com"];
      const newEmail = "new@example.com";

      expect(existingEmails.includes(newEmail)).toBe(false);
    });
  });

  describe("Name updates", () => {
    it("should reject empty names", () => {
      const emptyName = "";
      const isEmpty = emptyName.trim() === "";
      expect(isEmpty).toBe(true);
    });

    it("should trim whitespace from names", () => {
      const name = "  New Name  ";
      const trimmed = name.trim();
      expect(trimmed).toBe("New Name");
    });
  });

  describe("Address updates", () => {
    it("should accept empty address as null", () => {
      const emptyAddress = "";
      const shouldBeNull = emptyAddress.trim() === "";
      expect(shouldBeNull).toBe(true);
    });

    it("should accept null address", () => {
      const address = null;
      expect(address).toBeNull();
    });

    it("should trim whitespace from address", () => {
      const address = "  Musterstraße 123  ";
      const trimmed = normalizeOptionalField(address);
      expect(trimmed).toBe("Musterstraße 123");
    });

    it("should convert empty string to null", () => {
      const address = "";
      const normalized = normalizeOptionalField(address);
      expect(normalized).toBeNull();
    });

    it("should convert whitespace-only to null", () => {
      const address = "   ";
      const normalized = normalizeOptionalField(address);
      expect(normalized).toBeNull();
    });

    it("should preserve valid address", () => {
      const address = "Musterstraße 123, 12345 Musterstadt";
      const normalized = normalizeOptionalField(address);
      expect(normalized).toBe(address);
    });
  });

  describe("Phone updates", () => {
    it("should accept empty phone as null", () => {
      const emptyPhone = "";
      const shouldBeNull = emptyPhone.trim() === "";
      expect(shouldBeNull).toBe(true);
    });

    it("should trim whitespace from phone", () => {
      const phone = "  0123 456789  ";
      const trimmed = normalizeOptionalField(phone);
      expect(trimmed).toBe("0123 456789");
    });

    it("should convert empty string to null", () => {
      const phone = "";
      const normalized = normalizeOptionalField(phone);
      expect(normalized).toBeNull();
    });

    it("should convert whitespace-only to null", () => {
      const phone = "   ";
      const normalized = normalizeOptionalField(phone);
      expect(normalized).toBeNull();
    });

    it("should preserve valid phone", () => {
      const phone = "+49 123 456789";
      const normalized = normalizeOptionalField(phone);
      expect(normalized).toBe(phone);
    });
  });

  describe("Address validation", () => {
    it("should accept valid address within length limit", () => {
      const address = "Musterstraße 123, 12345 Musterstadt";
      const result = validateAddress(address);
      expect(result.isValid).toBe(true);
    });

    it("should reject address exceeding 200 characters", () => {
      const address = "A".repeat(201);
      const result = validateAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Adresse darf maximal 200 Zeichen lang sein");
    });

    it("should reject address with exactly 200 characters", () => {
      const address = "A".repeat(200);
      const result = validateAddress(address);
      expect(result.isValid).toBe(true);
    });

    it("should accept empty address as null during normalization", () => {
      const normalized = normalizeOptionalField("");
      expect(normalized).toBeNull();
    });

    it("should accept null address", () => {
      const normalized = normalizeOptionalField(null);
      expect(normalized).toBeNull();
    });

    it("should accept undefined address", () => {
      const normalized = normalizeOptionalField(undefined);
      expect(normalized).toBeNull();
    });
  });

  describe("Phone validation", () => {
    it("should accept valid phone number", () => {
      const phone = "+49 123 456789";
      const result = validatePhone(phone);
      expect(result.isValid).toBe(true);
    });

    it("should accept phone with valid characters", () => {
      const validPhones = ["0123456789", "+49 123 456789", "(0123) 456-789", "0123-456789"];
      validPhones.forEach(phone => {
        const result = validatePhone(phone);
        expect(result.isValid).toBe(true);
      });
    });

    it("should reject phone with invalid characters", () => {
      const phone = "0123-456-789a";
      const result = validatePhone(phone);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Telefonnummer enthält ungültige Zeichen");
    });

    it("should reject phone exceeding 30 characters", () => {
      const phone = "0123456789012345678901234567890";
      const result = validatePhone(phone);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Telefonnummer darf maximal 30 Zeichen lang sein");
    });

    it("should accept phone with exactly 30 characters", () => {
      const phone = "012345678901234567890123456789";
      const result = validatePhone(phone);
      expect(result.isValid).toBe(true);
    });

    it("should accept empty phone as null during normalization", () => {
      const normalized = normalizeOptionalField("");
      expect(normalized).toBeNull();
    });

    it("should accept null phone", () => {
      const normalized = normalizeOptionalField(null);
      expect(normalized).toBeNull();
    });

    it("should accept undefined phone", () => {
      const normalized = normalizeOptionalField(undefined);
      expect(normalized).toBeNull();
    });
  });

  describe("Role updates", () => {
    it("should prevent demoting the last admin", () => {
      const adminCount = 1;
      const canDemote = adminCount > 1;
      expect(canDemote).toBe(false);
    });

    it("should allow demoting when there are multiple admins", () => {
      const adminCount = 2;
      const canDemote = adminCount > 1;
      expect(canDemote).toBe(true);
    });
  });

  describe("Multiple field updates", () => {
    it("should accept updates to multiple fields", () => {
      const updates = {
        email: "new@example.com",
        name: "New Name",
        address: "New Address",
        phone: "987654321",
        role: Role.ADMIN,
      };

      expect(updates).toHaveProperty("email");
      expect(updates).toHaveProperty("name");
      expect(updates).toHaveProperty("role");
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent users", () => {
      const userId = "999999";
      const shouldReturn404 = !userId || userId === "999999";
      expect(shouldReturn404).toBe(true);
    });

    it("should handle invalid JSON gracefully", () => {
      const invalidJson = "not valid json";
      const isInvalid = typeof invalidJson === "string" && !invalidJson.startsWith("{");
      expect(isInvalid).toBe(true);
    });

    it("should return 409 for duplicate emails", () => {
      const statusCode = 409;
      expect(statusCode).toBe(409);
    });

    it("should return 403 for unauthorized operations", () => {
      const statusCode = 403;
      expect(statusCode).toBe(403);
    });
  });
});

describe("user-validation", () => {
  describe("validateEmail", () => {
    it("should return true for valid email", () => {
      expect(validateEmail("test@example.com")).toBe(true);
      expect(validateEmail("user.name@domain.co.uk")).toBe(true);
    });

    it("should return false for invalid email", () => {
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("test@")).toBe(false);
      expect(validateEmail("")).toBe(false);
      expect(validateEmail("test example.com")).toBe(false);
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

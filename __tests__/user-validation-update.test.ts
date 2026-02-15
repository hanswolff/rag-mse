import { validateUpdateProfileRequest } from "@/lib/user-validation";

describe("validateUpdateProfileRequest", () => {
  it("should pass with valid data", () => {
    const result = validateUpdateProfileRequest({
      email: "test@example.com",
      name: "Test User",
      address: "Test Street 123",
      phone: "+49 123 456789",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should pass with only partial data", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should reject empty string name (name is required)", () => {
    const result = validateUpdateProfileRequest({
      name: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Name ist erforderlich");
  });

  it("should fail with overly long name", () => {
    const result = validateUpdateProfileRequest({
      name: "A".repeat(101),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Name darf maximal 100 Zeichen lang sein");
  });

  it("should fail with invalid email format", () => {
    const result = validateUpdateProfileRequest({
      email: "invalid-email",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("E-Mail hat ungültiges Format");
  });

  it("should reject empty email (email is required)", () => {
    const result = validateUpdateProfileRequest({
      email: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("E-Mail ist erforderlich");
  });

  it("should allow missing optional fields", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should accept valid German phone format", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      phone: "+49 170 12345678",
    });

    expect(result.isValid).toBe(true);
  });

  it("should reject invalid phone characters", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      phone: "123-ABC",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Telefonnummer hat ungültiges Format");
  });

  it("should allow empty string phone", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      phone: "",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should allow empty string address", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      address: "",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should reject overly long address", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      address: "A".repeat(201),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Adresse darf maximal 200 Zeichen lang sein");
  });

  it("should accept address with newlines", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      address: "Musterstraße 1\n12345 Musterstadt\nDeutschland",
    });

    expect(result.isValid).toBe(true);
  });

  it("should accept optional reservists fields up to 30 chars", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      reservistsAssociation: "A".repeat(30),
      associationMemberNumber: "1".repeat(30),
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should reject reservists association longer than 30 chars", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      reservistsAssociation: "A".repeat(31),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Reservistenkameradschaft darf maximal 30 Zeichen lang sein");
  });

  it("should reject association member number longer than 30 chars", () => {
    const result = validateUpdateProfileRequest({
      name: "Test User",
      associationMemberNumber: "1".repeat(31),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Mitgliedsnummer im Verband darf maximal 30 Zeichen lang sein");
  });
});

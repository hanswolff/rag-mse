import { validateName } from "@/lib/user-validation";

describe("validateName (user-validation)", () => {
  it("should return valid for simple names", () => {
    const result = validateName("Max Mustermann");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return valid for names with German umlauts", () => {
    const result = validateName("Jürgen Müller");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return valid for names with hyphens", () => {
    const result = validateName("Anna-Maria Schmidt");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return valid for names with apostrophes", () => {
    const result = validateName("O'Connor");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return valid for names with dots", () => {
    const result = validateName("Dr. Max Mustermann");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return valid for name at minimum length", () => {
    const result = validateName("A");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return valid for name at maximum length", () => {
    const result = validateName("A".repeat(100));
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return invalid with error for empty string", () => {
    const result = validateName("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name ist erforderlich");
  });

  it("should return invalid with error for whitespace only", () => {
    const result = validateName("   ");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name ist erforderlich");
  });

  it("should return invalid with error for name exceeding maximum length", () => {
    const result = validateName("A".repeat(101));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name darf maximal 100 Zeichen lang sein");
  });

  it("should return invalid with error for name with numbers", () => {
    const result = validateName("Max123");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name enthält ungültige Zeichen");
  });

  it("should return invalid with error for name with special characters", () => {
    const result = validateName("Max@Mustermann");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name enthält ungültige Zeichen");
  });

  it("should return invalid with error for non-string values", () => {
    expect(validateName(null as unknown as string).isValid).toBe(false);
    expect(validateName(null as unknown as string).error).toBe("Ungültiger Name");

    expect(validateName(undefined as unknown as string).isValid).toBe(false);
    expect(validateName(undefined as unknown as string).error).toBe("Ungültiger Name");

    expect(validateName(123 as unknown as string).isValid).toBe(false);
    expect(validateName(123 as unknown as string).error).toBe("Ungültiger Name");
  });

  it("should trim whitespace before validation", () => {
    const result = validateName("  Max Mustermann  ");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should handle names with multiple spaces", () => {
    const result = validateName("Max   Mustermann");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

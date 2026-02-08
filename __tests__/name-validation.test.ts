import { validateName, nameRegex } from "@/lib/validation-schema";

describe("validateName (validation-schema)", () => {
  it("should accept simple names", () => {
    expect(validateName("Max Mustermann")).toBe(true);
    expect(validateName("Anna Schmidt")).toBe(true);
  });

  it("should accept names with German umlauts", () => {
    expect(validateName("Jürgen Müller")).toBe(true);
    expect(validateName("Günther Köhler")).toBe(true);
    expect(validateName("Björn")).toBe(true);
  });

  it("should accept names with ß", () => {
    expect(validateName("Weiß")).toBe(true);
    expect(validateName("Strauß")).toBe(true);
  });

  it("should accept names with hyphens", () => {
    expect(validateName("Anna-Maria Schmidt")).toBe(true);
    expect(validateName("Hans-Peter Müller")).toBe(true);
  });

  it("should accept names with apostrophes", () => {
    expect(validateName("D'Angelo")).toBe(true);
    expect(validateName("O'Connor")).toBe(true);
  });

  it("should accept names with dots (abbreviations)", () => {
    expect(validateName("Dr. Max Mustermann")).toBe(true);
    expect(validateName("Prof. Dr. Anna Schmidt")).toBe(true);
  });

  it("should accept names at minimum length", () => {
    expect(validateName("A")).toBe(true);
  });

  it("should accept names at maximum length", () => {
    expect(validateName("A".repeat(100))).toBe(true);
  });

  it("should reject empty strings", () => {
    expect(validateName("")).toBe(false);
  });

  it("should reject strings with only whitespace", () => {
    expect(validateName("   ")).toBe(false);
  });

  it("should reject names exceeding maximum length", () => {
    expect(validateName("A".repeat(101))).toBe(false);
  });

  it("should reject names with numbers", () => {
    expect(validateName("Max123")).toBe(false);
    expect(validateName("Max Mustermann 2")).toBe(false);
  });

  it("should reject names with special characters", () => {
    expect(validateName("Max@Mustermann")).toBe(false);
    expect(validateName("Max#Mustermann")).toBe(false);
    expect(validateName("Max$Mustermann")).toBe(false);
    expect(validateName("Max%Mustermann")).toBe(false);
  });

  it("should reject non-string values", () => {
    expect(validateName(null as unknown as string)).toBe(false);
    expect(validateName(undefined as unknown as string)).toBe(false);
    expect(validateName(123 as unknown as string)).toBe(false);
    expect(validateName({} as unknown as string)).toBe(false);
  });

  it("should trim whitespace", () => {
    expect(validateName("  Max Mustermann  ")).toBe(true);
  });
});

describe("nameRegex", () => {
  it("should match valid names", () => {
    expect(nameRegex.test("Max Mustermann")).toBe(true);
    expect(nameRegex.test("Jürgen Müller")).toBe(true);
    expect(nameRegex.test("Anna-Maria Schmidt")).toBe(true);
    expect(nameRegex.test("O'Connor")).toBe(true);
    expect(nameRegex.test("Dr. Max Mustermann")).toBe(true);
  });

  it("should not match invalid names", () => {
    expect(nameRegex.test("Max123")).toBe(false);
    expect(nameRegex.test("Max@Mustermann")).toBe(false);
    expect(nameRegex.test("Max Mustermann!")).toBe(false);
  });
});

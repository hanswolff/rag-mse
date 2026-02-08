import { validateContactFormData } from "@/lib/contact-validation";

describe("validateContactFormData", () => {
  it("should validate correct contact form data", () => {
    const data = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should reject empty name", () => {
    const data = {
      name: "",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Name muss mindestens 2 Zeichen lang sein");
  });

  it("should reject name that is too short", () => {
    const data = {
      name: "M",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Name muss mindestens 2 Zeichen lang sein");
  });

  it("should reject name that is too long", () => {
    const data = {
      name: "A".repeat(101),
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Name darf maximal 100 Zeichen lang sein");
  });

  it("should reject invalid email format", () => {
    const data = {
      name: "Max Mustermann",
      email: "invalid-email",
      message: "Dies ist eine Testnachricht.",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Bitte geben Sie eine gültige E-Mail-Adresse ein");
  });

  it("should reject email without @", () => {
    const data = {
      name: "Max Mustermann",
      email: "invalidexample.com",
      message: "Dies ist eine Testnachricht.",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Bitte geben Sie eine gültige E-Mail-Adresse ein");
  });

  it("should reject empty message", () => {
    const data = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Nachricht muss mindestens 10 Zeichen lang sein");
  });

  it("should reject message that is too short", () => {
    const data = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Kurz",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Nachricht muss mindestens 10 Zeichen lang sein");
  });

  it("should reject message that is too long", () => {
    const data = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "A".repeat(2001),
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Nachricht darf maximal 2000 Zeichen lang sein");
  });

  it("should reject multiple errors", () => {
    const data = {
      name: "M",
      email: "invalid-email",
      message: "Kurz",
    };

    const result = validateContactFormData(data);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(3);
    expect(result.errors).toContain("Name muss mindestens 2 Zeichen lang sein");
    expect(result.errors).toContain("Bitte geben Sie eine gültige E-Mail-Adresse ein");
    expect(result.errors).toContain("Nachricht muss mindestens 10 Zeichen lang sein");
  });

});

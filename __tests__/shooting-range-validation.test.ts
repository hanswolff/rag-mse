import { shootingRangeFormSchema, shootingRangeValidationConfig } from "@/lib/validation-schema";

describe("shootingRangeFormSchema", () => {
  const validData = {
    name: "Schießstand Neubrandenburg",
    street: "Musterstraße 1",
    postalCode: "17033",
    city: "Neubrandenburg",
    latitude: "53.5544",
    longitude: "13.2613",
  };

  it("accepts valid data", () => {
    const result = shootingRangeFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts minimal data (only required fields)", () => {
    const result = shootingRangeFormSchema.safeParse({
      name: "Teststand",
      street: "",
      postalCode: "",
      city: "",
      latitude: "52.0",
      longitude: "13.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects street longer than 200 characters", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, street: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects postalCode longer than 10 characters", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, postalCode: "12345678901" });
    expect(result.success).toBe(false);
  });

  it("rejects city longer than 100 characters", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, city: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects empty latitude", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, latitude: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty longitude", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, longitude: "" });
    expect(result.success).toBe(false);
  });

  it("rejects latitude out of range (> 90)", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, latitude: "91" });
    expect(result.success).toBe(false);
  });

  it("rejects latitude out of range (< -90)", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, latitude: "-91" });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range (> 180)", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, longitude: "181" });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range (< -180)", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, longitude: "-181" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric latitude", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, latitude: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric longitude", () => {
    const result = shootingRangeFormSchema.safeParse({ ...validData, longitude: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts boundary latitude values", () => {
    expect(shootingRangeFormSchema.safeParse({ ...validData, latitude: "90" }).success).toBe(true);
    expect(shootingRangeFormSchema.safeParse({ ...validData, latitude: "-90" }).success).toBe(true);
    expect(shootingRangeFormSchema.safeParse({ ...validData, latitude: "0" }).success).toBe(true);
  });

  it("accepts boundary longitude values", () => {
    expect(shootingRangeFormSchema.safeParse({ ...validData, longitude: "180" }).success).toBe(true);
    expect(shootingRangeFormSchema.safeParse({ ...validData, longitude: "-180" }).success).toBe(true);
    expect(shootingRangeFormSchema.safeParse({ ...validData, longitude: "0" }).success).toBe(true);
  });
});

describe("shootingRangeValidationConfig", () => {
  it("has all required fields configured", () => {
    expect(shootingRangeValidationConfig).toHaveProperty("name");
    expect(shootingRangeValidationConfig).toHaveProperty("street");
    expect(shootingRangeValidationConfig).toHaveProperty("postalCode");
    expect(shootingRangeValidationConfig).toHaveProperty("city");
    expect(shootingRangeValidationConfig).toHaveProperty("latitude");
    expect(shootingRangeValidationConfig).toHaveProperty("longitude");
  });

  it("each field has a zod schema", () => {
    for (const config of Object.values(shootingRangeValidationConfig)) {
      expect(config).toHaveProperty("zod");
    }
  });
});

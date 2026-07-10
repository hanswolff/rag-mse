import {
  isAusschreibungCurrent,
  parseAusschreibungExpiresAt,
  validateCreateAusschreibungMetadata,
  parseAndValidateUpdateAusschreibungRequest,
  normalizeAusschreibungTitle,
  normalizeAusschreibungDescription,
} from "@/lib/ausschreibung-validation";

describe("isAusschreibungCurrent", () => {
  it("gilt als aktuell, wenn das Ablaufdatum heute ist (Grenzfall)", () => {
    const expiresAt = parseAusschreibungExpiresAt("2026-08-01");
    const referenceDate = new Date("2026-08-01T12:00:00.000Z");
    expect(isAusschreibungCurrent(expiresAt, referenceDate)).toBe(true);
  });

  it("gilt als historisch am Tag nach dem Ablaufdatum", () => {
    const expiresAt = parseAusschreibungExpiresAt("2026-08-01");
    const referenceDate = new Date("2026-08-02T00:00:00.000Z");
    expect(isAusschreibungCurrent(expiresAt, referenceDate)).toBe(false);
  });

  it("gilt als aktuell, wenn das Ablaufdatum in der Zukunft liegt", () => {
    const expiresAt = parseAusschreibungExpiresAt("2026-12-31");
    const referenceDate = new Date("2026-08-01T12:00:00.000Z");
    expect(isAusschreibungCurrent(expiresAt, referenceDate)).toBe(true);
  });

  it("berücksichtigt die deutsche Zeitzone am Tagesübergang", () => {
    const expiresAt = parseAusschreibungExpiresAt("2026-08-01");
    // 2026-08-01 23:30 UTC ist bereits 2026-08-02 01:30 in Europe/Berlin (Sommerzeit)
    const referenceDate = new Date("2026-08-01T23:30:00.000Z");
    expect(isAusschreibungCurrent(expiresAt, referenceDate)).toBe(false);
  });
});

describe("validateCreateAusschreibungMetadata", () => {
  it("verlangt einen Titel", () => {
    const result = validateCreateAusschreibungMetadata({ title: "", expiresAt: "2026-08-01" });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("Titel");
  });

  it("verlangt ein Ablaufdatum", () => {
    const result = validateCreateAusschreibungMetadata({ title: "Landesmeisterschaft" });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("Ablaufdatum");
  });

  it("akzeptiert gültige Eingaben ohne Beschreibung", () => {
    const result = validateCreateAusschreibungMetadata({
      title: "Landesmeisterschaft",
      expiresAt: "2026-08-01",
    });
    expect(result.isValid).toBe(true);
  });

  it("lehnt ein ungültiges Ablaufdatum ab", () => {
    const result = validateCreateAusschreibungMetadata({
      title: "Landesmeisterschaft",
      expiresAt: "not-a-date",
    });
    expect(result.isValid).toBe(false);
  });
});

describe("parseAndValidateUpdateAusschreibungRequest", () => {
  it("lehnt leeren Body ab", () => {
    const result = parseAndValidateUpdateAusschreibungRequest({});
    expect(result.isValid).toBe(false);
  });

  it("lehnt unbekannte Felder ab", () => {
    const result = parseAndValidateUpdateAusschreibungRequest({ unexpected: "x" });
    expect(result.isValid).toBe(false);
  });

  it("akzeptiert eine Teilaktualisierung des Titels", () => {
    const result = parseAndValidateUpdateAusschreibungRequest({ title: "Neuer Titel" });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.data.title).toBe("Neuer Titel");
    }
  });

  it("erlaubt das Löschen der Beschreibung mit null", () => {
    const result = parseAndValidateUpdateAusschreibungRequest({ description: null });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.data.description).toBeNull();
    }
  });
});

describe("normalizeAusschreibungTitle / normalizeAusschreibungDescription", () => {
  it("trimmt und kollabiert Whitespace im Titel", () => {
    expect(normalizeAusschreibungTitle("  Landesmeisterschaft   Schießsport  ")).toBe("Landesmeisterschaft Schießsport");
  });

  it("wandelt leere Beschreibung in null um", () => {
    expect(normalizeAusschreibungDescription("   ")).toBeNull();
    expect(normalizeAusschreibungDescription(undefined)).toBeNull();
  });
});

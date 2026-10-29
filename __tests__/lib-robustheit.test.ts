import { createLoginProof, validateLoginProof } from "../lib/auth-proof";
import { renderEmailTemplate } from "../lib/email-templates";
import { parseUserPayload } from "../lib/user-payload";
import { validateProductionConfig } from "../lib/config-validation";
import { getDevModeSmtpConfig } from "../lib/email/config";
import { appName } from "../lib/site-config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Login-Proof mit manipulierter Signatur", () => {
  it("lehnt eine Signatur mit Nicht-ASCII-Zeichen gleicher Zeichenlänge ab, statt zu werfen", () => {
    process.env.NEXTAUTH_SECRET = "a".repeat(40);
    const proof = createLoginProof("max@example.com", "1.2.3.4", "Geheim123");
    const [version, payload, signature] = proof.split(".");
    const tampered = `${version}.${payload}.${"ä".repeat(signature.length)}`;

    expect(() => validateLoginProof(tampered, "max@example.com", "1.2.3.4", "Geheim123")).not.toThrow();
    expect(validateLoginProof(tampered, "max@example.com", "1.2.3.4", "Geheim123")).toBe(false);
    expect(validateLoginProof(proof, "max@example.com", "1.2.3.4", "Geheim123")).toBe(true);
  });
});

describe("E-Mail-Templates", () => {
  it("setzt appName auch ohne explizite Variable ein (Umfrage-Benachrichtigung)", async () => {
    const result = await renderEmailTemplate("umfrage-benachrichtigung", {
      pollTitle: "Sommerfest",
      pollDescription: "",
      pollUrl: "https://example.com/u/abc",
      userName: "Max",
    });

    expect(result.body).not.toContain("{{appName}}");
    expect(result.body.trimEnd().endsWith(appName)).toBe(true);
  });
});

describe("Benutzer-Update: Datumsfelder", () => {
  it("speichert ein Geburtsdatum mit Leerraum als UTC-Kalendertag", async () => {
    const parsed = await parseUserPayload({ dateOfBirth: " 1990-01-01 " }, { mode: "update" });

    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.dateOfBirth?.toISOString()).toBe("1990-01-01T00:00:00.000Z");
  });
});

describe("Konfigurations-Validierung: APP_TIMEZONE", () => {
  it("meldet eine ungültige Zeitzone als Fehler", () => {
    process.env.APP_TIMEZONE = "Mars/Olympus";

    const result = validateProductionConfig();

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("APP_TIMEZONE"))).toBe(true);
  });

  it("akzeptiert eine gültige Zeitzone", () => {
    process.env.APP_TIMEZONE = "Europe/Berlin";

    const result = validateProductionConfig();

    expect(result.errors.some((error) => error.includes("APP_TIMEZONE"))).toBe(false);
  });
});

describe("Dev-Modus-Absender", () => {
  it("liefert ohne SMTP-Konfiguration einen Absender statt zu werfen", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;

    expect(getDevModeSmtpConfig().from).toContain("<noreply@localhost>");
  });
});

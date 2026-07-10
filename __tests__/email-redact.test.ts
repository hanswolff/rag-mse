import { redactSensitiveLinkTokens } from "@/lib/email/redact";

describe("redactSensitiveLinkTokens", () => {
  it("redacts password reset tokens", () => {
    const input = "Bitte klicken Sie hier: https://example.com/passwort-zuruecksetzen/abc123DEF-token";
    expect(redactSensitiveLinkTokens(input)).toBe(
      "Bitte klicken Sie hier: https://example.com/passwort-zuruecksetzen/***REDACTED***"
    );
  });

  it("redacts invitation tokens", () => {
    const input = "Link: https://example.com/einladung/superSecretToken123";
    expect(redactSensitiveLinkTokens(input)).toBe("Link: https://example.com/einladung/***REDACTED***");
  });

  it("redacts RSVP and unsubscribe tokens", () => {
    const input =
      "RSVP: https://example.com/anmeldung/rsvp-token, Abmelden: https://example.com/benachrichtigungen/abmelden/unsub-token";
    expect(redactSensitiveLinkTokens(input)).toBe(
      "RSVP: https://example.com/anmeldung/***REDACTED***, Abmelden: https://example.com/benachrichtigungen/abmelden/***REDACTED***"
    );
  });

  it("redacts tokens inside HTML anchor href and link text alike", () => {
    const input =
      '<a href="https://example.com/passwort-zuruecksetzen/abc123">https://example.com/passwort-zuruecksetzen/abc123</a>';
    const result = redactSensitiveLinkTokens(input);
    expect(result).not.toContain("abc123");
    expect(result.match(/\*\*\*REDACTED\*\*\*/g)).toHaveLength(2);
  });

  it("leaves unrelated content untouched", () => {
    const input = "Kontaktanfrage von max@example.com: Hallo, ich habe eine Frage.";
    expect(redactSensitiveLinkTokens(input)).toBe(input);
  });
});

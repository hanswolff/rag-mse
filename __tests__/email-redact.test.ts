import {
  redactSensitiveLinkTokens,
  extractSensitiveLinkTokens,
  restoreSensitiveLinkTokens,
  serializeSensitiveTokens,
  parseSensitiveTokens,
} from "@/lib/email/redact";

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

describe("Einmal-Token nicht im Klartext speichern", () => {
  const resetLink = "https://example.com/passwort-zuruecksetzen/abc123DEF-token";
  const inviteLink = "https://example.com/einladung/XyZ987token";

  it("ersetzt Token durch Platzhalter und liefert sie separat", () => {
    const { redacted, tokens } = extractSensitiveLinkTokens([
      `Text: ${resetLink}`,
      `<a href="${resetLink}">Link</a>`,
    ]);

    expect(tokens).toEqual(["abc123DEF-token"]);
    redacted.forEach((part) => {
      expect(part).not.toContain("abc123DEF-token");
      expect(part).toContain("***TOKEN_0***");
    });
  });

  it("vergibt je unterschiedlichem Token einen eigenen Platzhalter", () => {
    const { redacted, tokens } = extractSensitiveLinkTokens([`${resetLink} und ${inviteLink}`]);

    expect(tokens).toEqual(["abc123DEF-token", "XyZ987token"]);
    expect(redacted[0]).toContain("***TOKEN_0***");
    expect(redacted[0]).toContain("***TOKEN_1***");
  });

  it("stellt die Original-Links für den Versand wieder her", () => {
    const original = `Text: ${resetLink}\nEinladung: ${inviteLink}`;
    const { redacted, tokens } = extractSensitiveLinkTokens([original]);

    expect(restoreSensitiveLinkTokens(redacted[0], tokens)).toBe(original);
  });

  it("serialisiert und liest Token verlustfrei, leer bleibt null", () => {
    expect(serializeSensitiveTokens([])).toBeNull();
    expect(parseSensitiveTokens(serializeSensitiveTokens(["a", "b"]))).toEqual(["a", "b"]);
    expect(parseSensitiveTokens(null)).toEqual([]);
    expect(parseSensitiveTokens("kein json")).toEqual([]);
  });

  it("lässt Inhalte ohne Token unverändert", () => {
    const { redacted, tokens } = extractSensitiveLinkTokens(["Hallo, hier ist nichts Geheimes."]);

    expect(tokens).toEqual([]);
    expect(redacted[0]).toBe("Hallo, hier ist nichts Geheimes.");
  });
});

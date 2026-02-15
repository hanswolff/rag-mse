import { renderEmailTemplate } from "../lib/email-templates";

describe("email templates", () => {
  it("renders contact template placeholders", async () => {
    const result = await renderEmailTemplate("contact", {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Hallo zusammen",
    });

    expect(result.subject).toBe("Kontaktformular: Nachricht von Max Mustermann");
    expect(result.body).toContain("Max Mustermann");
    expect(result.body).toContain("max@example.com");
    expect(result.body).toContain("Hallo zusammen");
  });

  it("renders invitation template placeholders", async () => {
    const result = await renderEmailTemplate("einladung-zur-rag-mse", {
      appName: "RAG Schießsport MSE",
      inviteUrl: "https://example.com/einladung/test",
      inviteValidityDays: "14",
    });

    expect(result.subject).toBe("Einladung zur RAG MSE");
    expect(result.body).toContain("https://example.com/einladung/test");
    expect(result.body).toContain("14 Tage");
  });

  it("renders password reset template placeholders", async () => {
    const result = await renderEmailTemplate("passwort-zuruecksetzen", {
      appName: "RAG Schießsport MSE",
      resetUrl: "https://example.com/passwort-zuruecksetzen/test-token",
    });

    expect(result.subject).toBe("Passwort zurücksetzen für RAG Schießsport MSE");
    expect(result.body).toContain("https://example.com/passwort-zuruecksetzen/test-token");
    expect(result.body).toContain("24 Stunden");
  });

  it("renders event reminder template placeholders", async () => {
    const result = await renderEmailTemplate("termin-erinnerung", {
      appName: "RAG Schießsport MSE",
      daysBefore: "7",
      eventDate: "20.02.2026",
      eventTimeFrom: "18:00",
      eventTimeTo: "20:00",
      eventLocation: "Schießstand Ulm",
      rsvpUrl: "https://example.com/anmeldung/token",
      unsubscribeUrl: "https://example.com/benachrichtigungen/abmelden/token",
    });

    expect(result.subject).toContain("Erinnerung");
    expect(result.body).toContain("7 Tag");
    expect(result.body).toContain("20.02.2026");
    expect(result.body).toContain("https://example.com/anmeldung/token");
    expect(result.body).toContain("https://example.com/benachrichtigungen/abmelden/token");
  });
});

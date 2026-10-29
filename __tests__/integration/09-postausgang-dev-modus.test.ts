import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/lib/email-sender";
import { processDueEmailOutboxBatch } from "@/lib/email/outbox-worker";

// Dev-Modus heißt: SMTP bewusst unkonfiguriert (lokal, E2E). Der Worker darf dann
// nicht an der fehlenden SMTP-Konfiguration scheitern, sondern protokolliert.
beforeAll(() => {
  process.env.EMAIL_DEV_MODE = "true";
  process.env.EMAIL_DEV_LOG_METHOD = "logger";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_FROM;
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("Integrationsschicht: Postausgang im Dev-Modus", () => {
  it("versendet ohne SMTP-Konfiguration (Protokoll statt SMTP)", async () => {
    const { outboxId } = await sendTemplateEmail({
      template: "umfrage-benachrichtigung",
      to: "mitglied@example.com",
      variables: { pollTitle: "Test", pollDescription: "", pollUrl: "http://localhost:3000/u/x", userName: "Max" },
    });

    await processDueEmailOutboxBatch();

    const email = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: outboxId } });
    expect(email.status).toBe(OutgoingEmailStatus.SENT);
    expect(email.lastError).toBeNull();
  });
});

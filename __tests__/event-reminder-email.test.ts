jest.mock("@/lib/email-sender", () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => ({
  logApiError: jest.fn(),
}));

import { sendTemplateEmail } from "@/lib/email-sender";
import { sendEventReminderEmail } from "@/lib/notifications";

const baseEvent = {
  id: "event-1",
  date: new Date("2026-02-20T00:00:00.000Z"),
  timeFrom: "18:00",
  timeTo: "20:00",
  location: "Schießstand Ulm",
  title: null as string | null,
  type: null as string | null,
};

async function sendReminderFor(event: Partial<typeof baseEvent>) {
  await sendEventReminderEmail({
    email: "max@example.org",
    event: { ...baseEvent, ...event },
    daysBefore: 7,
    rsvpUrl: "https://example.org/anmeldung/token",
    unsubscribeUrl: "https://example.org/benachrichtigungen/abmelden/token",
  });

  return (sendTemplateEmail as jest.Mock).mock.calls[0][0].variables;
}

describe("sendEventReminderEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("names title and Terminart when a title is set", async () => {
    const variables = await sendReminderFor({
      title: "Dynamisches Pistolenschießen Level 1",
      type: "Lehrgang",
    });

    expect(variables.eventHeadline).toBe(
      "Titel: Dynamisches Pistolenschießen Level 1\nTerminart: Lehrgang\n"
    );
  });

  it("omits the Terminart line when only a title is set", async () => {
    const variables = await sendReminderFor({ title: "Vereinsabend" });

    expect(variables.eventHeadline).toBe("Titel: Vereinsabend\n");
  });

  it("adds nothing for events without a title", async () => {
    const variables = await sendReminderFor({ type: "Training" });

    expect(variables.eventHeadline).toBe("");
    expect(variables.eventDate).toBe("20.02.2026");
    expect(variables.eventLocation).toBe("Schießstand Ulm");
  });
});

import { processEventReminders } from "@/lib/reminders/event-reminder-worker";
import { prisma } from "@/lib/prisma";
import { renderEventReminderEmail } from "@/lib/reminders/notifications";
import { enqueueRenderedEmail } from "@/lib/email-sender";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/reminders/notifications", () => ({
  buildNotificationRsvpUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/anmeldung/${token}`),
  buildNotificationUnsubscribeUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/benachrichtigungen/abmelden/${token}`),
  generateNotificationToken: jest.fn(() => "token-123"),
  getNotificationTokenExpiryDate: jest.fn(() => new Date("2026-03-01T00:00:00.000Z")),
  hashNotificationToken: jest.fn((token: string) => `hash-${token}`),
  renderEventReminderEmail: jest.fn(),
}));

jest.mock("@/lib/email-sender", () => ({
  enqueueRenderedEmail: jest.fn(),
}));

const renderedEmail = { template: "termin-erinnerung", recipients: ["max@example.org"] };

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

describe("event-reminder-worker", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    (renderEventReminderEmail as jest.Mock).mockResolvedValue(renderedEmail);
    (enqueueRenderedEmail as jest.Mock).mockResolvedValue({ queued: true, outboxId: "outbox-1" });
    process.env = {
      ...originalEnv,
      APP_URL: "https://example.org",
      APP_TIMEZONE: "Europe/Berlin",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("stores dispatch and email in one transaction", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.eventReminderDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: "event-1", sentAt: expect.any(Date) }),
      })
    );
    expect(enqueueRenderedEmail).toHaveBeenCalledWith(renderedEmail, prisma);
  });

  it("passes title and Terminart to the reminder email", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
        title: "Dynamisches Pistolenschießen Level 1",
        type: "Lehrgang",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(renderEventReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          title: "Dynamisches Pistolenschießen Level 1",
          type: "Lehrgang",
        }),
      })
    );
  });

  it("does not count the reminder when queueing the email fails", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });
    (enqueueRenderedEmail as jest.Mock).mockRejectedValue(new Error("DB lock"));

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(0);
    expect(prisma.eventReminderDispatch.update).not.toHaveBeenCalled();
    expect(prisma.eventReminderDispatch.delete).not.toHaveBeenCalled();
  });

  it("ignores duplicate dispatches caused by unique constraint", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockRejectedValue({ code: "P2002" });

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(0);
    expect(enqueueRenderedEmail).not.toHaveBeenCalled();
  });

  it("sends reminder when within poll interval window of target time", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 1 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-01-03T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    // Event starts 18:00 Europe/Berlin, reminder should fire 1 day before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-01-02T16:57:00.000Z"));

    expect(queued).toBe(1);
    expect(prisma.eventReminderDispatch.create).toHaveBeenCalledTimes(1);
    expect(prisma.eventReminderDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "event-1",
        }),
      })
    );
  });

  it("continues processing after single event queue failure", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00:00",
        timeTo: "20:00",
        location: "Ulm",
      },
      {
        id: "event-2",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00:02",
        timeTo: "20:00",
        location: "Neu-Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock)
      .mockResolvedValueOnce({ id: "dispatch-1" })
      .mockResolvedValueOnce({ id: "dispatch-2" });
    (enqueueRenderedEmail as jest.Mock)
      .mockRejectedValueOnce(new Error("DB lock"))
      .mockResolvedValueOnce({ queued: true, outboxId: "outbox-2" });

    // Events start at 18:00 Europe/Berlin
    // Current time is within poll interval + grace period window for both reminders
    const queued = await processEventReminders(new Date("2026-02-01T16:57:00.000Z"));

    // First event fails, second one is still processed
    expect(queued).toBe(1);
    expect(prisma.eventReminderDispatch.create).toHaveBeenCalledTimes(2);
    expect(renderEventReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("respects APP_TIMEZONE when calculating reminder timestamp", async () => {
    process.env.APP_TIMEZONE = "UTC";
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    const queued = await processEventReminders(new Date("2026-02-01T17:57:00.000Z"));

    expect(queued).toBe(1);
  });

  it("does not queue at the Berlin reminder time when APP_TIMEZONE is UTC", async () => {
    process.env.APP_TIMEZONE = "UTC";
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);

    const queued = await processEventReminders(new Date("2026-02-01T16:57:00.000Z"));

    expect(queued).toBe(0);
  });

  it("skips members with an existing reminder before rendering the email", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
        eventReminderDispatches: [{ userId: "user-1" }],
      },
    ]);

    const queued = await processEventReminders(new Date("2026-02-03T09:00:00.000Z"));

    expect(queued).toBe(0);
    expect(renderEventReminderEmail).not.toHaveBeenCalled();
  });

  it("excludes non-activated users from reminders", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "active@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
      // user-2 is not returned because activatedAt: { not: null } filters it out in the real query
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(1);
    expect(renderEventReminderEmail).toHaveBeenCalledTimes(1);
    expect(renderEventReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "active@example.org",
      })
    );
  });

  it("sends reminders to activated users", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "activated@example.org", role: "MEMBER", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);
    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(1);
    expect(renderEventReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "activated@example.org",
      })
    );
  });

  it("sends reminders to auditors", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "auditor-1", email: "audit@example.org", role: "AUDITOR", eventReminderDaysBefore: 7 },
    ]);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event-1",
        date: new Date("2026-02-08T17:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
      },
    ]);

    (prisma.eventReminderDispatch.create as jest.Mock).mockResolvedValue({ id: "dispatch-1" });

    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(1);
    expect(prisma.event.findMany).toHaveBeenCalled();
    expect(renderEventReminderEmail).toHaveBeenCalledTimes(1);
    expect(renderEventReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "audit@example.org",
      })
    );
  });
});

import { processEventReminders } from "@/lib/event-reminder-worker";
import { prisma } from "@/lib/prisma";
import { sendEventReminderEmail } from "@/lib/notifications";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
    },
    eventReminderDispatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/notifications", () => ({
  buildNotificationRsvpUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/anmeldung/${token}`),
  buildNotificationUnsubscribeUrl: jest.fn((appUrl: string, token: string) => `${appUrl}/benachrichtigungen/abmelden/${token}`),
  generateNotificationToken: jest.fn(() => "token-123"),
  getNotificationTokenExpiryDate: jest.fn(() => new Date("2026-03-01T00:00:00.000Z")),
  hashNotificationToken: jest.fn((token: string) => `hash-${token}`),
  sendEventReminderEmail: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

describe("event-reminder-worker", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue(null);
    process.env = {
      ...originalEnv,
      APP_URL: "https://example.org",
      APP_TIMEZONE: "Europe/Berlin",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("queues reminder and sets sentAt after successful delivery", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (prisma.eventReminderDispatch.update as jest.Mock).mockResolvedValue({ id: "dispatch-1" });
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: true });

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(1);
    expect(prisma.eventReminderDispatch.create).toHaveBeenCalledTimes(1);
    expect(prisma.eventReminderDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
      data: { sentAt: expect.any(Date) },
      select: { id: true },
    });
    expect(prisma.eventReminderDispatch.delete).not.toHaveBeenCalled();
  });

  it("deletes dispatch and does not set sentAt when delivery fails", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (prisma.eventReminderDispatch.delete as jest.Mock).mockResolvedValue({ id: "dispatch-1" });
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: false });

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(0);
    expect(prisma.eventReminderDispatch.delete).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
    });
    expect(prisma.eventReminderDispatch.update).not.toHaveBeenCalled();
  });

  it("ignores duplicate dispatches caused by unique constraint", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      id: "dispatch-1",
      sentAt: new Date("2026-01-30T10:00:00.000Z"),
      queuedAt: new Date("2026-01-30T09:00:00.000Z"),
    });

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(0);
    expect(sendEventReminderEmail).not.toHaveBeenCalled();
  });

  it("sends reminder when within poll interval window of target time", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 1 },
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
    (prisma.eventReminderDispatch.update as jest.Mock).mockResolvedValue({ id: "dispatch-1" });
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: true });

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

  it("retries pending duplicate dispatches older than resend delay", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      id: "dispatch-pending",
      sentAt: null,
      queuedAt: new Date("2026-01-20T10:00:00.000Z"),
    });
    (prisma.eventReminderDispatch.update as jest.Mock)
      .mockResolvedValueOnce({ id: "dispatch-pending" })
      .mockResolvedValueOnce({ id: "dispatch-pending" });
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: true });

    // Event starts 18:00 Europe/Berlin, reminder should fire 7 days before at 17:00 UTC
    // Current time is within poll interval + grace period window
    const queued = await processEventReminders(new Date("2026-02-01T16:56:00.000Z"));

    expect(queued).toBe(1);
    expect(prisma.eventReminderDispatch.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "dispatch-pending" },
        data: expect.objectContaining({
          queuedAt: new Date("2026-02-01T16:56:00.000Z"),
          sentAt: null,
        }),
      })
    );
    expect(prisma.eventReminderDispatch.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "dispatch-pending" },
        data: { sentAt: expect.any(Date) },
      })
    );
  });

  it("continues processing after single event queue failure", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: true });
    (prisma.eventReminderDispatch.update as jest.Mock)
      .mockRejectedValueOnce(new Error("DB lock"))
      .mockRejectedValueOnce(new Error("DB lock"))
      .mockRejectedValueOnce(new Error("DB lock"))
      .mockResolvedValueOnce({ id: "dispatch-2" });

    // Events start at 18:00 Europe/Berlin
    // Current time is within poll interval + grace period window for both reminders
    const queued = await processEventReminders(new Date("2026-02-01T16:57:00.000Z"));

    // First event fails after retries, second one is still processed
    expect(queued).toBe(1);
    expect(prisma.eventReminderDispatch.create).toHaveBeenCalledTimes(2);
    expect(sendEventReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("respects APP_TIMEZONE when calculating reminder timestamp", async () => {
    process.env.APP_TIMEZONE = "UTC";
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (prisma.eventReminderDispatch.update as jest.Mock).mockResolvedValue({ id: "dispatch-1" });
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: true });

    const queued = await processEventReminders(new Date("2026-02-01T17:57:00.000Z"));

    expect(queued).toBe(1);
  });

  it("does not queue at the same UTC timestamp when APP_TIMEZONE is Europe/Berlin", async () => {
    process.env.APP_TIMEZONE = "Europe/Berlin";
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "max@example.org", eventReminderDaysBefore: 7 },
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
    (sendEventReminderEmail as jest.Mock).mockResolvedValue({ success: true });

    const queued = await processEventReminders(new Date("2026-02-01T17:57:00.000Z"));

    expect(queued).toBe(0);
  });
});

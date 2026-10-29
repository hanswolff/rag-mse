import { GET } from "@/app/api/admin/notifications/preview/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { loadEmailTemplate } from "@/lib/email-templates";
import { EVENT_REMINDER_EMAIL_TEMPLATE } from "@/lib/reminders/notifications";
import { formatDate, formatTime } from "@/lib/date-utils";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/auth-utils", () => ({
  requireAuth: jest.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = "Keine Berechtigung") {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

function staticTemplateLines(templateBody: string): string[] {
  return templateBody
    .split("\n")
    .filter((line) => line.trim().length > 0 && !line.includes("{{"));
}

describe("/api/admin/notifications/preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("renders the event reminder preview from the real template including the headline block", async () => {
    const event = {
      date: new Date("2026-02-22T00:00:00.000Z"),
      timeFrom: "18:00",
      timeTo: "20:00",
      location: "Ulm",
      title: "Kreismeisterschaft",
      type: "Wettkampf",
    };
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      daysBefore: 7,
      event,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/notifications/preview?type=event&id=dispatch-1");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.eventReminderDispatch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dispatch-1" } }),
    );

    const template = await loadEmailTemplate(EVENT_REMINDER_EMAIL_TEMPLATE);
    expect(data.subject).toBe(template.subject);
    for (const line of staticTemplateLines(template.body)) {
      expect(data.body).toContain(line);
    }

    expect(data.body).toContain(`Titel: ${event.title}`);
    expect(data.body).toContain(`Terminart: ${event.type}`);
    expect(data.body).toContain(`Datum: ${formatDate(event.date.toISOString())}`);
    expect(data.body).toContain(`Uhrzeit: ${formatTime(event.timeFrom)} - ${formatTime(event.timeTo)}`);
    expect(data.body).toContain(`Ort: ${event.location}`);
    expect(data.body).toContain("[Link enthält persönlichen Anmelde-Token]");
    expect(data.body).toContain("[Link enthält persönlichen Abmelde-Token]");
    expect(data.subject).not.toMatch(/\{\{/);
    expect(data.body).not.toMatch(/\{\{/);
  });

  it("omits the headline block for events without a title", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      daysBefore: 3,
      event: {
        date: new Date("2026-03-01T00:00:00.000Z"),
        timeFrom: "10:00",
        timeTo: "12:00",
        location: "Neubrandenburg",
        title: null,
        type: null,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/admin/notifications/preview?type=event&id=dispatch-2");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.body).not.toContain("Titel:");
    expect(data.body).not.toContain("Terminart:");
    expect(data.body).not.toMatch(/\{\{/);
  });

  it("renders the poll notification preview from the real template", async () => {
    const poll = {
      id: "poll-1",
      title: "Vereinsausflug 2026",
      description: "Bitte bis Ende des Monats abstimmen.",
    };
    (prisma.pollNotificationDispatch.findUnique as jest.Mock).mockResolvedValue({
      user: { name: "Max Mustermann" },
      poll,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/notifications/preview?type=poll&id=dispatch-3");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.pollNotificationDispatch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dispatch-3" } }),
    );

    const template = await loadEmailTemplate("umfrage-benachrichtigung");
    expect(data.subject).toContain(poll.title);
    for (const line of staticTemplateLines(template.body)) {
      expect(data.body).toContain(line);
    }

    expect(data.body).toContain("Hallo Max Mustermann");
    expect(data.body).toContain(poll.description);
    expect(data.body).toContain(`/u/${poll.id}`);
    expect(data.subject).not.toMatch(/\{\{/);
    expect(data.body).not.toMatch(/\{\{/);
  });

  it("returns 400 when the id is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/notifications/preview?type=event");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown dispatch", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications/preview?type=event&id=missing");
    const response = await GET(request);

    expect(response.status).toBe(404);
  });

  it("rejects users without admin notification access", async () => {
    (requireAuth as jest.Mock).mockResolvedValue({
      id: "member-1",
      role: "MEMBER",
      email: "member@example.com",
    });

    const request = new NextRequest("http://localhost:3000/api/admin/notifications/preview?type=event&id=dispatch-1");
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(prisma.eventReminderDispatch.findUnique).not.toHaveBeenCalled();
  });
});

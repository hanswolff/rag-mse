import { GET } from "@/app/api/admin/notifications/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    eventReminderDispatch: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    pollNotificationDispatch: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAuth: jest.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = "Keine Berechtigung") {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

describe("/api/admin/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("returns paginated notifications from the last 30 days", async () => {
    (prisma.eventReminderDispatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "dispatch-1",
        sentAt: new Date("2026-02-15T10:00:00.000Z"),
        queuedAt: new Date("2026-02-15T09:59:00.000Z"),
        daysBefore: 7,
        user: {
          id: "user-1",
          name: "Max Mustermann",
          email: "max@example.com",
        },
        event: {
          id: "event-1",
          date: new Date("2026-02-22T00:00:00.000Z"),
          timeFrom: "18:00",
          timeTo: "20:00",
          location: "Ulm",
        },
      },
    ]);
    (prisma.eventReminderDispatch.count as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?page=1&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(requireAuth).toHaveBeenCalled();
    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0].event.date).toBe("2026-02-22");
    expect(data.notifications[0].user.name).toBe("Max Mustermann");
    expect(data.notifications[0].status).toBe("VERSENDET");
    expect(data.notifications[0].queuedAt).toBe("2026-02-15T09:59:00.000Z");
    expect(data.pagination).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    });

    const firstCall = (prisma.eventReminderDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.OR).toHaveLength(2);
    expect(firstCall.where.OR[0].sentAt.not).toBeNull();
    expect(firstCall.where.OR[0].sentAt.gte).toBeInstanceOf(Date);
    expect(firstCall.where.OR[1].sentAt).toBeNull();
    expect(firstCall.where.OR[1].queuedAt.gte).toBeInstanceOf(Date);
    expect(firstCall.orderBy).toEqual([{ sentAt: "desc" }, { queuedAt: "desc" }, { id: "desc" }]);
  });

  it("applies search query for name or email", async () => {
    (prisma.eventReminderDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.eventReminderDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?q=Max");
    await GET(request);

    const firstCall = (prisma.eventReminderDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.user).toEqual({
      OR: [
        { name: { contains: "Max" } },
        { email: { contains: "Max" } },
      ],
    });
  });

  it("enforces max page size", async () => {
    (prisma.eventReminderDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.eventReminderDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?limit=999&page=2");
    await GET(request);

    const firstCall = (prisma.eventReminderDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.take).toBe(100);
    expect(firstCall.skip).toBe(100);
  });

  it("uses requested sorting for user fields", async () => {
    (prisma.eventReminderDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.eventReminderDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?sortBy=userName&sortDir=asc");
    await GET(request);

    const firstCall = (prisma.eventReminderDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.orderBy).toEqual([{ user: { name: "asc" } }, { user: { email: "asc" } }, { id: "desc" }]);
  });

  it("falls back to default sort field for invalid sortBy", async () => {
    (prisma.eventReminderDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.eventReminderDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?sortBy=unknown&sortDir=asc");
    await GET(request);

    const firstCall = (prisma.eventReminderDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.orderBy).toEqual([{ sentAt: "asc" }, { queuedAt: "asc" }, { id: "desc" }]);
  });

  it("returns 403 for auditor role", async () => {
    (requireAuth as jest.Mock).mockResolvedValue({
      id: "auditor-1",
      role: "AUDITOR",
      email: "auditor@example.com",
    });

    const request = new NextRequest("http://localhost:3000/api/admin/notifications");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("returns poll notifications when type=poll", async () => {
    (prisma.pollNotificationDispatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "poll-dispatch-1",
        sentAt: new Date("2026-03-01T12:00:00.000Z"),
        queuedAt: new Date("2026-03-01T11:55:00.000Z"),
        user: {
          id: "user-2",
          name: "Anna Schmidt",
          email: "anna@example.com",
        },
        poll: {
          id: "poll-1",
          title: "Sommerfest Planung",
          description: "Wann passt es euch am besten?",
        },
      },
    ]);
    (prisma.pollNotificationDispatch.count as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?type=poll&page=1&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0].type).toBe("poll");
    expect(data.notifications[0].poll.title).toBe("Sommerfest Planung");
    expect(data.notifications[0].poll.description).toBe("Wann passt es euch am besten?");
    expect(data.notifications[0].user.name).toBe("Anna Schmidt");
    expect(data.notifications[0].status).toBe("VERSENDET");
    expect(data.pagination).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    });

    expect(prisma.pollNotificationDispatch.findMany).toHaveBeenCalled();
    expect(prisma.eventReminderDispatch.findMany).not.toHaveBeenCalled();
  });

  it("applies search to poll notifications", async () => {
    (prisma.pollNotificationDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.pollNotificationDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?type=poll&q=Anna");
    await GET(request);

    const firstCall = (prisma.pollNotificationDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.user).toEqual({
      OR: [
        { name: { contains: "Anna" } },
        { email: { contains: "Anna" } },
      ],
    });
  });

  it("defaults to event type when no type param", async () => {
    (prisma.eventReminderDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.eventReminderDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?page=1");
    await GET(request);

    expect(prisma.eventReminderDispatch.findMany).toHaveBeenCalled();
    expect(prisma.pollNotificationDispatch.findMany).not.toHaveBeenCalled();
  });

  it("supports pollTitle sorting for poll type", async () => {
    (prisma.pollNotificationDispatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.pollNotificationDispatch.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/notifications?type=poll&sortBy=pollTitle&sortDir=asc");
    await GET(request);

    const firstCall = (prisma.pollNotificationDispatch.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.orderBy).toEqual([{ poll: { title: "asc" } }, { id: "desc" }]);
  });
});

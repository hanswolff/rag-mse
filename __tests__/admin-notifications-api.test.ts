import { GET } from "@/app/api/admin/notifications/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    eventReminderDispatch: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

describe("/api/admin/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
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
    expect(requireAdmin).toHaveBeenCalled();
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
});

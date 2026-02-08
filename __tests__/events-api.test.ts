import { GET } from "@/app/api/events/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStartOfToday } from "@/lib/date-picker-utils";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("/api/events/route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("returns paginated upcoming and past events", async () => {
      const mockEvents = [
        {
          id: "1",
          date: new Date("2026-02-10"),
          timeFrom: "18:00",
          timeTo: "20:00",
          location: "Test Location",
          description: "Test Description",
          latitude: 50.0,
          longitude: 10.0,
          type: "TRAINING",
          visible: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          _count: { votes: 3 },
        },
      ];

      const mockPastEvents = [
        {
          id: "2",
          date: new Date("2026-01-15"),
          timeFrom: "18:00",
          timeTo: "20:00",
          location: "Past Location",
          description: "Past Description",
          latitude: null,
          longitude: null,
          type: "COMPETITION",
          visible: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          _count: { votes: 5 },
        },
      ];

      (prisma.event.findMany as jest.Mock)
        .mockResolvedValueOnce(mockEvents)
        .mockResolvedValueOnce(mockPastEvents);
      (prisma.event.count as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?page=1&limit=20");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(1);
      expect(data.pastEvents).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
      expect(data.pastPagination.total).toBe(1);
      expect(data.events[0].date).toBe("2026-02-10");
      expect(data.pastEvents[0].date).toBe("2026-01-15");
    });

    it("uses start of today as cutoff date", async () => {
      const currentStart = getStartOfToday();

      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events");
      await GET(request);

      expect(prisma.event.findMany).toHaveBeenCalledTimes(2);
      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      const secondCall = (prisma.event.findMany as jest.Mock).mock.calls[1][0];

      expect(firstCall.where.date).toEqual({ gte: currentStart });
      expect(secondCall.where.date).toEqual({ lt: currentStart });
    });

    it("filters events by visibility for non-authenticated users", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.where).toHaveProperty("visible", true);
      expect(firstCall.select).not.toHaveProperty("_count");
    });

    it("allows members to see their own events", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com", role: "MEMBER" },
      });

      const request = new NextRequest("http://localhost:3000/api/events");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.where.OR).toEqual([
        { visible: true },
        { createdById: "user-123" },
      ]);
      expect(firstCall.select).toHaveProperty("_count");
    });

    it("allows admins to see all events", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue({
        user: { id: "admin-123", email: "admin@example.com", role: "ADMIN" },
      });

      const request = new NextRequest("http://localhost:3000/api/events");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.where).not.toHaveProperty("visible");
      expect(firstCall.where).not.toHaveProperty("OR");
      expect(firstCall.select).toHaveProperty("_count");
    });

    it("handles custom page size", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?page=2&limit=10");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      const secondCall = (prisma.event.findMany as jest.Mock).mock.calls[1][0];

      expect(firstCall.skip).toBe(10);
      expect(firstCall.take).toBe(10);
      expect(secondCall.skip).toBe(0);
      expect(secondCall.take).toBe(10);
    });

    it("handles custom past page", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?pastPage=3&limit=20");
      await GET(request);

      const secondCall = (prisma.event.findMany as jest.Mock).mock.calls[1][0];
      expect(secondCall.skip).toBe(40);
      expect(secondCall.take).toBe(20);
    });

    it("limits page size to MAX_PAGE_SIZE", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?limit=100");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.take).toBe(50);
    });

    it("handles errors gracefully", async () => {
      (prisma.event.findMany as jest.Mock).mockRejectedValue(new Error("Database error"));
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Ein Fehler ist aufgetreten");
    });

    it("calculates pagination correctly", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(10);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?limit=10");
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.total).toBe(25);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.pages).toBe(3);
      expect(data.pastPagination.pages).toBe(1);
    });

    it("sets cache-control headers on successful response", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events");
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
      expect(response.headers.get("Vary")).toBe("Authorization, Cookie");
    });
  });

  describe("parsePageSize", () => {
    it("returns default when value is null", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.take).toBe(20);
    });

    it("returns default when value is invalid", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?limit=invalid");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.take).toBe(20);
    });

    it("returns default when value is negative", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?limit=-5");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.take).toBe(20);
    });
  });

  describe("parsePageNumber", () => {
    it("returns 1 when value is null", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.skip).toBe(0);
    });

    it("returns 1 when value is invalid", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?page=invalid");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.skip).toBe(0);
    });

    it("returns 1 when value is negative", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events?page=-2");
      await GET(request);

      const firstCall = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCall.skip).toBe(0);
    });
  });
});

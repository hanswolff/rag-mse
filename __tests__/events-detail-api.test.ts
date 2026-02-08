import { GET } from "@/app/api/events/[id]/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

describe("/api/events/[id]/route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    const mockEvent = {
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
      createdById: "creator-123",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    it("sets cache-control headers on 404 for non-existent event", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    });

    it("sets cache-control headers on 404 for invisible event", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        ...mockEvent,
        visible: false,
      });
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    });

    it("sets cache-control and vary headers on successful response for non-authenticated user", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
      expect(response.headers.get("Vary")).toBe("Authorization, Cookie");
    });

    it("sets cache-control and vary headers on successful response for authenticated member", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        ...mockEvent,
        votes: [],
      });
      getServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com", role: "MEMBER" },
      });

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
      expect(response.headers.get("Vary")).toBe("Authorization, Cookie");
    });

    it("sets cache-control and vary headers on successful response for admin with votes", async () => {
      const mockEventWithVotes = {
        ...mockEvent,
        votes: [
          { id: "vote-1", vote: "JA", user: { id: "user-1", name: "User 1" } },
          { id: "vote-2", vote: "NEIN", user: { id: "user-2", name: "User 2" } },
        ],
      };
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEventWithVotes);
      getServerSession.mockResolvedValue({
        user: { id: "admin-123", email: "admin@example.com", role: "ADMIN" },
      });

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
      expect(response.headers.get("Vary")).toBe("Authorization, Cookie");
    });

    it("sets cache-control and vary headers on successful response for member without votes", async () => {
      const mockEventWithVotes = {
        ...mockEvent,
        votes: [
          { id: "vote-1", vote: "JA", user: { id: "user-1", name: "User 1" } },
        ],
      };
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEventWithVotes);
      getServerSession.mockResolvedValue({
        user: { id: "user-123", email: "test@example.com", role: "MEMBER" },
      });

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
      expect(response.headers.get("Vary")).toBe("Authorization, Cookie");
    });

    it("sets cache-control and vary headers when creator sees invisible event", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        ...mockEvent,
        visible: false,
        votes: [],
      });
      getServerSession.mockResolvedValue({
        user: { id: "creator-123", email: "creator@example.com", role: "MEMBER" },
      });

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
      expect(response.headers.get("Vary")).toBe("Authorization, Cookie");
    });

    it("sets cache-control headers on 404 when admin sees invisible non-owned event", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        ...mockEvent,
        visible: false,
        votes: [],
      });
      getServerSession.mockResolvedValue({
        user: { id: "other-user-123", email: "other@example.com", role: "MEMBER" },
      });

      const request = new NextRequest("http://localhost:3000/api/events/1");
      const response = await GET(request, { params: { id: "1" } });

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    });
  });
});

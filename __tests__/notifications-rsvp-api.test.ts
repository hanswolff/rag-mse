import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/notifications/rsvp/[token]/route";
import { prisma } from "@/lib/prisma";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    eventReminderDispatch: {
      findUnique: jest.fn(),
    },
    vote: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkTokenRateLimit: jest.fn(),
  recordSuccessfulTokenUsage: jest.fn(),
}));

describe("/api/notifications/rsvp/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkTokenRateLimit as jest.Mock).mockResolvedValue({ allowed: true, attemptCount: 1 });
    (recordSuccessfulTokenUsage as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 404 for invisible events instead of 200", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      rsvpTokenExpiresAt: new Date(Date.now() + 60_000),
      event: {
        id: "event-1",
        date: new Date("2026-03-01T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
        description: "Test",
        latitude: null,
        longitude: null,
        type: null,
        visible: false,
      },
      user: {
        id: "user-1",
        name: "Max",
      },
    });

    const request = new NextRequest("http://localhost:3000/api/notifications/rsvp/abc");
    const response = await GET(request, { params: Promise.resolve({ token: "abc" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("ungültig");
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
  });

  it("returns current event data and vote for valid token", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      rsvpTokenExpiresAt: new Date(Date.now() + 60_000),
      event: {
        id: "event-1",
        date: new Date("2026-03-01T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
        description: "Test",
        latitude: null,
        longitude: null,
        type: null,
        visible: true,
      },
      user: {
        id: "user-1",
        name: "Max",
      },
    });
    (prisma.vote.findUnique as jest.Mock).mockResolvedValue({
      id: "vote-1",
      vote: "JA",
    });

    const request = new NextRequest("http://localhost:3000/api/notifications/rsvp/abc");
    const response = await GET(request, { params: Promise.resolve({ token: "abc" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.name).toBe("Max");
    expect(data.currentVote.vote).toBe("JA");
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(recordSuccessfulTokenUsage).toHaveBeenCalled();
  });

  it("rejects invalid vote payload", async () => {
    const request = new NextRequest("http://localhost:3000/api/notifications/rsvp/abc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: "INVALID" }),
    });

    const response = await POST(request, { params: Promise.resolve({ token: "abc" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Ungültige Teilnahmeanmeldung");
    expect(prisma.vote.upsert).not.toHaveBeenCalled();
  });

  it("saves vote for valid token", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      rsvpTokenExpiresAt: new Date(Date.now() + 60_000),
      event: {
        id: "event-1",
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Ulm",
        description: "Test",
        latitude: null,
        longitude: null,
        type: null,
        visible: true,
      },
      user: {
        id: "user-1",
        name: "Max",
      },
    });
    (prisma.vote.upsert as jest.Mock).mockResolvedValue({
      id: "vote-1",
      vote: "VIELLEICHT",
      eventId: "event-1",
      userId: "user-1",
    });

    const request = new NextRequest("http://localhost:3000/api/notifications/rsvp/abc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: "VIELLEICHT" }),
    });

    const response = await POST(request, { params: Promise.resolve({ token: "abc" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.vote).toBe("VIELLEICHT");
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(prisma.vote.upsert).toHaveBeenCalled();
  });
});

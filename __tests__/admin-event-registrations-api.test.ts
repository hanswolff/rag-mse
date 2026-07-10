import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/admin/events/[id]/registrations/route";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    vote: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    guestRegistration: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

describe("/api/admin/events/[id]/registrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("returns members and guests for an event", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValueOnce({ id: "event-1" });
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "user-1", name: "Max", email: "max@example.com", votes: [{ vote: "JA" }] },
      { id: "user-2", name: "Eva", email: "eva@example.com", votes: [] },
    ]);
    (prisma.guestRegistration.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "guest-1", name: "Gast A", vote: "VIELLEICHT" },
    ]);

    const response = await GET(new NextRequest("http://localhost:3000/api/admin/events/event-1/registrations"), {
      params: Promise.resolve({ id: "event-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.members).toEqual([
      { userId: "user-1", name: "Max", vote: "JA" },
      { userId: "user-2", name: "Eva", vote: null },
    ]);
    expect(json.guests).toEqual([{ id: "guest-1", name: "Gast A", vote: "VIELLEICHT" }]);
  });

  it("upserts member registration", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValueOnce({ id: "event-1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "user-1",
      name: "Max",
      email: "max@example.com",
    });
    (prisma.vote.upsert as jest.Mock).mockResolvedValueOnce({ vote: "NEIN" });

    const request = new NextRequest("http://localhost:3000/api/admin/events/event-1/registrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "member", userId: "user-1", vote: "NEIN" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "event-1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.type).toBe("member");
    expect(json.registration).toEqual({ userId: "user-1", name: "Max", vote: "NEIN" });
  });

  it("validates guest name on create", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValueOnce({ id: "event-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/events/event-1/registrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "guest", name: "", vote: "JA" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "event-1" }) });

    expect(response.status).toBe(400);
  });

  it("deletes guest registration", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValueOnce({ id: "event-1" });
    (prisma.guestRegistration.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const request = new NextRequest("http://localhost:3000/api/admin/events/event-1/registrations", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "guest", name: "Gast A" }),
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "event-1" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });
});

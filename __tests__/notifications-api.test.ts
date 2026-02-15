import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/user/notifications/route";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAuth: jest.fn(),
}));

describe("/api/user/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      role: "MEMBER",
    });
  });

  it("returns notification settings in GET", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      eventReminderEnabled: true,
      eventReminderDaysBefore: 7,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      eventReminderEnabled: true,
      eventReminderDaysBefore: 7,
    });
  });

  it("updates notification settings in PUT", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({
      eventReminderEnabled: false,
      eventReminderDaysBefore: 5,
    });

    const request = new NextRequest("http://localhost:3000/api/user/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventReminderEnabled: false,
        eventReminderDaysBefore: 5,
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      eventReminderEnabled: false,
      eventReminderDaysBefore: 5,
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: {
          eventReminderEnabled: false,
          eventReminderDaysBefore: 5,
        },
      })
    );
  });

  it("rejects invalid reminder day range", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventReminderEnabled: true,
        eventReminderDaysBefore: 99,
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("zwischen 1 und 14");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

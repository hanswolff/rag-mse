import { NextRequest } from "next/server";
import { POST } from "@/app/api/notifications/unsubscribe/[token]/route";
import { prisma } from "@/lib/prisma";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";
import { logError } from "@/lib/logger";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    eventReminderDispatch: {
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/rate-limiter", () => ({
  checkTokenRateLimit: jest.fn(),
  recordSuccessfulTokenUsage: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  maskToken: jest.fn((value: string) => `${value.slice(0, 3)}...`),
}));

describe("/api/notifications/unsubscribe/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkTokenRateLimit as jest.Mock).mockResolvedValue({ allowed: true, attemptCount: 1 });
    (recordSuccessfulTokenUsage as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 404 for unknown tokens", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/notifications/unsubscribe/token");
    const response = await POST(request, { params: Promise.resolve({ token: "token" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("ungültig");
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
  });

  it("returns 410 for expired tokens", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      unsubscribeTokenExpiresAt: new Date(Date.now() - 60_000),
      user: {
        role: "MEMBER",
      },
    });

    const request = new NextRequest("http://localhost:3000/api/notifications/unsubscribe/token");
    const response = await POST(request, { params: Promise.resolve({ token: "token" }) });
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error).toContain("abgelaufen");
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("disables reminders for valid tokens", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      unsubscribeTokenExpiresAt: new Date(Date.now() + 60_000),
      user: {
        role: "MEMBER",
      },
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const request = new NextRequest("http://localhost:3000/api/notifications/unsubscribe/token");
    const response = await POST(request, { params: Promise.resolve({ token: "token" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { eventReminderEnabled: false },
    });
    expect(recordSuccessfulTokenUsage).toHaveBeenCalled();
  });

  it("allows unsubscribe for auditor users", async () => {
    (prisma.eventReminderDispatch.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      unsubscribeTokenExpiresAt: new Date(Date.now() + 60_000),
      user: {
        role: "AUDITOR",
      },
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const request = new NextRequest("http://localhost:3000/api/notifications/unsubscribe/token");
    const response = await POST(request, { params: Promise.resolve({ token: "token" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { eventReminderEnabled: false },
    });
  });

  it("returns 503 when token rate limiter is unavailable in fail-closed mode", async () => {
    process.env.RATE_LIMIT_FAIL_OPEN = "false";
    (checkTokenRateLimit as jest.Mock).mockRejectedValue(new Error("redis down"));

    const request = new NextRequest("http://localhost:3000/api/notifications/unsubscribe/token");
    const response = await POST(request, { params: Promise.resolve({ token: "token" }) });
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain("Dienst aktuell nicht verfügbar");
    expect(logError).toHaveBeenCalledWith(
      "token_rate_limit_unavailable",
      expect.stringContaining("blocking request"),
      expect.any(Object)
    );
  });
});

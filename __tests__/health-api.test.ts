jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock("@/lib/redis-client", () => ({
  getRedisClient: jest.fn(),
}));

import { GET } from "@/app/api/health/route";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis-client";

describe("/api/health", () => {
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;
  const mockGetRedisClient = getRedisClient as jest.Mock;
  const mockPing = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockReturnValue({ ping: mockPing });
  });

  it("returns ok only when database and redis are reachable", async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);
    mockPing.mockResolvedValue("PONG");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: "ok",
      timestamp: expect.any(String),
      checks: {
        database: "ok",
        redis: "ok",
      },
    });
  });

  it("returns 503 when a dependency check fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      status: "error",
      timestamp: expect.any(String),
    });
  });
});

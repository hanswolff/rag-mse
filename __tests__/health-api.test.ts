jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { GET } from "@/app/api/health/route";
import { prisma } from "@/lib/prisma";

describe("/api/health", () => {
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns ok when the database is reachable", async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: "ok",
      timestamp: expect.any(String),
      checks: {
        database: "ok",
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

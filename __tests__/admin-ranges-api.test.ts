jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/ranges/route";
import { PUT, DELETE } from "@/app/api/admin/ranges/[id]/route";
import { apiRequest, routeContext } from "./helpers/request";
import { buildShootingRange } from "./helpers/factories";

const mockAdmin = { id: "admin-1", role: "ADMIN", email: "admin@test.de" };

const sampleRange = buildShootingRange();

describe("/api/admin/ranges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdmin);
  });

  describe("GET", () => {
    it("returns all ranges sorted by name", async () => {
      (prisma.shootingRange.findMany as jest.Mock).mockResolvedValue([sampleRange]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ranges).toHaveLength(1);
      expect(data.ranges[0].name).toBe("Schießstand Test");
    });

    it("requires admin authentication", async () => {
      (requireAdmin as jest.Mock).mockRejectedValue(new Error("Nicht autorisiert"));

      const response = await GET();

      expect(response.status).toBe(500);
    });
  });

  describe("POST", () => {
    const validBody = {
      name: "Neuer Stand",
      street: "Musterweg 5",
      postalCode: "17033",
      city: "Neubrandenburg",
      latitude: "53.5544",
      longitude: "13.2613",
    };

    it("creates a new range with valid data", async () => {
      (prisma.shootingRange.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.shootingRange.create as jest.Mock).mockResolvedValue({
        id: "new-range",
        ...validBody,
        latitude: 53.5544,
        longitude: 13.2613,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = apiRequest("POST", "/api/admin/ranges", { body: validBody, browser: true });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.name).toBe("Neuer Stand");
    });

    it("rejects duplicate name", async () => {
      (prisma.shootingRange.findUnique as jest.Mock).mockResolvedValue(sampleRange);

      const request = apiRequest("POST", "/api/admin/ranges", { body: validBody, browser: true });

      const response = await POST(request);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toContain("existiert bereits");
    });

    it("rejects empty name", async () => {
      const request = apiRequest("POST", "/api/admin/ranges", { body: { ...validBody, name: "" }, browser: true });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("rejects missing coordinates", async () => {
      const request = apiRequest("POST", "/api/admin/ranges", { body: { ...validBody, latitude: "", longitude: "" }, browser: true });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("rejects invalid latitude", async () => {
      const request = apiRequest("POST", "/api/admin/ranges", { body: { ...validBody, latitude: "999" }, browser: true });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});

describe("/api/admin/ranges/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdmin);
  });

  describe("PUT", () => {
    const updateBody = {
      name: "Aktualisierter Stand",
      street: "Neue Straße 10",
      postalCode: "17034",
      city: "Neubrandenburg",
      latitude: "53.56",
      longitude: "13.27",
    };

    it("updates an existing range", async () => {
      (prisma.shootingRange.findUnique as jest.Mock)
        .mockResolvedValueOnce(sampleRange)
        .mockResolvedValueOnce(null);
      (prisma.shootingRange.update as jest.Mock).mockResolvedValue({
        ...sampleRange,
        ...updateBody,
        latitude: 53.56,
        longitude: 13.27,
      });

      const request = apiRequest("PUT", "/api/admin/ranges/range-1", { body: updateBody, browser: true });

      const response = await PUT(request, routeContext({ id: "range-1" }));
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe("Aktualisierter Stand");
    });

    it("returns 404 for non-existent range", async () => {
      (prisma.shootingRange.findUnique as jest.Mock).mockResolvedValue(null);

      const request = apiRequest("PUT", "/api/admin/ranges/nonexistent", { body: updateBody, browser: true });

      const response = await PUT(request, routeContext({ id: "nonexistent" }));
      expect(response.status).toBe(404);
    });

    it("rejects duplicate name on update", async () => {
      (prisma.shootingRange.findUnique as jest.Mock)
        .mockResolvedValueOnce(sampleRange)
        .mockResolvedValueOnce({ id: "other-range", name: "Aktualisierter Stand" });

      const request = apiRequest("PUT", "/api/admin/ranges/range-1", { body: updateBody, browser: true });

      const response = await PUT(request, routeContext({ id: "range-1" }));
      expect(response.status).toBe(409);
    });
  });

  describe("DELETE", () => {
    it("deletes an existing range", async () => {
      (prisma.shootingRange.findUnique as jest.Mock).mockResolvedValue(sampleRange);
      (prisma.shootingRange.delete as jest.Mock).mockResolvedValue(sampleRange);

      const request = apiRequest("DELETE", "/api/admin/ranges/range-1", { browser: true });

      const response = await DELETE(request, routeContext({ id: "range-1" }));
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("returns 404 for non-existent range", async () => {
      (prisma.shootingRange.findUnique as jest.Mock).mockResolvedValue(null);

      const request = apiRequest("DELETE", "/api/admin/ranges/nonexistent", { browser: true });

      const response = await DELETE(request, routeContext({ id: "nonexistent" }));
      expect(response.status).toBe(404);
    });
  });
});

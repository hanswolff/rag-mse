jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logResourceNotFound: jest.fn(),
  logValidationFailure: jest.fn(),
  logApiError: jest.fn(),
  logAccessDenied: jest.fn(),
  maskEmail: (email: string) => email,
}));

jest.mock("@/lib/audit-log", () => ({
  logAdminAction: jest.fn(),
}));

jest.mock("@/lib/event-reminder-worker", () => ({
  triggerImmediateEventReminders: jest.fn().mockResolvedValue(0),
}));

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/events/route";
import { PUT } from "@/app/api/admin/events/[id]/route";
import { NextRequest } from "next/server";

const mockAdmin = { id: "admin-1", role: "ADMIN", email: "admin@test.de" };

function createRequest(url: string, options: RequestInit = {}) {
  const { signal, ...rest } = options;
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    ...rest,
    signal: signal ?? undefined,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

const validBody = {
  date: "2026-09-12",
  timeFrom: "10:00",
  timeTo: "16:00",
  location: "Schießstand Waren",
  description: "<p>Kurs mit externem Referenten</p>",
  type: "Lehrgang",
};

const existingEvent = {
  id: "event-1",
  date: new Date("2026-09-12T10:00:00.000Z"),
  timeFrom: "10:00",
  timeTo: "16:00",
  location: "Schießstand Waren",
  title: null,
  description: "<p>Kurs</p>",
  latitude: null,
  longitude: null,
  type: "Lehrgang",
  visible: true,
  createdById: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function lastCreateData() {
  return (prisma.event.create as jest.Mock).mock.calls[0][0].data;
}

function lastUpdateData() {
  return (prisma.event.update as jest.Mock).mock.calls[0][0].data;
}

describe("/api/admin/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdmin);
    (prisma.event.create as jest.Mock).mockImplementation(async ({ data }) => ({
      ...existingEvent,
      ...data,
    }));
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(existingEvent);
    (prisma.event.update as jest.Mock).mockImplementation(async ({ data }) => ({
      ...existingEvent,
      ...data,
    }));
  });

  describe("POST", () => {
    it("stores the title", async () => {
      const response = await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, title: "Dynamisches Pistolenschießen Level 1" }),
        })
      );

      expect(response.status).toBe(201);
      expect(lastCreateData().title).toBe("Dynamisches Pistolenschießen Level 1");
    });

    it("stores no title when the field is omitted", async () => {
      const response = await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify(validBody),
        })
      );

      expect(response.status).toBe(201);
      expect(lastCreateData().title).toBeNull();
    });

    it("treats a blank title as not set", async () => {
      await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, title: "   " }),
        })
      );

      expect(lastCreateData().title).toBeNull();
    });

    it("stores the cost note", async () => {
      await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, cost: "25 € für Mitglieder, 40 € für Gäste" }),
        })
      );

      expect(lastCreateData().cost).toBe("25 € für Mitglieder, 40 € für Gäste");
    });

    it("stores no cost note when the field is omitted", async () => {
      await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify(validBody),
        })
      );

      expect(lastCreateData().cost).toBeNull();
    });

    it("stores the capacity as a number", async () => {
      await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, capacity: "12" }),
        })
      );

      expect(lastCreateData().capacity).toBe(12);
    });

    it("stores no capacity when the field is empty", async () => {
      await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, capacity: "" }),
        })
      );

      expect(lastCreateData().capacity).toBeNull();
    });

    it("rejects a non-positive capacity", async () => {
      const response = await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, capacity: 0 }),
        })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it("rejects a fractional capacity", async () => {
      const response = await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, capacity: 2.5 }),
        })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it("rejects a title that exceeds the length limit", async () => {
      const response = await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, title: "a".repeat(201) }),
        })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    // Zuvor wurde der Wert über String(...) zu "[object Object]" bzw. bei einer
    // Terminart über .trim() zu einem 500er. Beides muss ein sauberer 400 sein,
    // ohne dass irgendetwas gespeichert wird.
    it.each([
      ["title", { boese: true }],
      ["cost", { boese: true }],
      ["type", { boese: true }],
    ])("rejects %s sent as an object without writing", async (field, value) => {
      const response = await POST(
        createRequest("http://localhost:3000/api/admin/events", {
          method: "POST",
          body: JSON.stringify({ ...validBody, [field]: value }),
        })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    const params = { params: Promise.resolve({ id: "event-1" }) };

    it("updates the title", async () => {
      const response = await PUT(
        createRequest("http://localhost:3000/api/admin/events/event-1", {
          method: "PUT",
          body: JSON.stringify({ title: "Neuer Titel" }),
        }),
        params
      );

      expect(response.status).toBe(200);
      expect(lastUpdateData().title).toBe("Neuer Titel");
    });

    it("clears the title when an empty value is sent", async () => {
      await PUT(
        createRequest("http://localhost:3000/api/admin/events/event-1", {
          method: "PUT",
          body: JSON.stringify({ title: "" }),
        }),
        params
      );

      expect(lastUpdateData().title).toBeNull();
    });

    it("clears the cost note when an empty value is sent", async () => {
      await PUT(
        createRequest("http://localhost:3000/api/admin/events/event-1", {
          method: "PUT",
          body: JSON.stringify({ cost: "" }),
        }),
        params
      );

      expect(lastUpdateData().cost).toBeNull();
    });

    it("clears the capacity when an empty value is sent", async () => {
      await PUT(
        createRequest("http://localhost:3000/api/admin/events/event-1", {
          method: "PUT",
          body: JSON.stringify({ capacity: "" }),
        }),
        params
      );

      expect(lastUpdateData().capacity).toBeNull();
    });

    it.each([
      ["title", "titel"],
      ["cost", "kosten"],
    ])("clears %s when an explicit null is sent", async (field) => {
      await PUT(
        createRequest("http://localhost:3000/api/admin/events/event-1", {
          method: "PUT",
          body: JSON.stringify({ [field]: null }),
        }),
        params
      );

      expect(lastUpdateData()[field]).toBeNull();
    });

    it("leaves the title untouched when the field is omitted", async () => {
      await PUT(
        createRequest("http://localhost:3000/api/admin/events/event-1", {
          method: "PUT",
          body: JSON.stringify({ location: "Vereinsheim" }),
        }),
        params
      );

      expect(lastUpdateData()).not.toHaveProperty("title");
    });
  });
});

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

jest.mock("@/lib/audit-log", () => ({
  logAdminAction: jest.fn(),
}));

jest.mock("@/lib/reminders/event-reminder-worker", () => ({
  triggerImmediateEventReminders: jest.fn().mockResolvedValue(0),
}));

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/events/route";
import { PUT } from "@/app/api/admin/events/[id]/route";
import { triggerImmediateEventReminders } from "@/lib/reminders/event-reminder-worker";
import { apiRequest, routeContext } from "./helpers/request";
import { buildEvent } from "./helpers/factories";

const mockAdmin = { id: "admin-1", role: "ADMIN", email: "admin@test.de" };

const validBody = {
  date: "2026-09-12",
  timeFrom: "10:00",
  timeTo: "16:00",
  location: "Schießstand Waren",
  description: "<p>Kurs mit externem Referenten</p>",
  type: "Lehrgang",
  visibility: "PUBLIC",
};

const existingEvent = buildEvent({
  id: "event-1",
  date: new Date("2026-09-12T10:00:00.000Z"),
  timeFrom: "10:00",
  timeTo: "16:00",
  location: "Schießstand Waren",
  description: "<p>Kurs</p>",
  latitude: null,
  longitude: null,
  type: "Lehrgang",
});

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
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, title: "Dynamisches Pistolenschießen Level 1" }, browser: true })
      );

      expect(response.status).toBe(201);
      expect(lastCreateData().title).toBe("Dynamisches Pistolenschießen Level 1");
    });

    it("stores no title when the field is omitted", async () => {
      const response = await POST(
        apiRequest("POST", "/api/admin/events", { body: validBody, browser: true })
      );

      expect(response.status).toBe(201);
      expect(lastCreateData().title).toBeNull();
    });

    it("treats a blank title as not set", async () => {
      await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, title: "   " }, browser: true })
      );

      expect(lastCreateData().title).toBeNull();
    });

    it("stores the cost note", async () => {
      await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, cost: "25 € für Mitglieder, 40 € für Gäste" }, browser: true })
      );

      expect(lastCreateData().cost).toBe("25 € für Mitglieder, 40 € für Gäste");
    });

    it("stores no cost note when the field is omitted", async () => {
      await POST(
        apiRequest("POST", "/api/admin/events", { body: validBody, browser: true })
      );

      expect(lastCreateData().cost).toBeNull();
    });

    it("stores the capacity as a number", async () => {
      await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, capacity: "12" }, browser: true })
      );

      expect(lastCreateData().capacity).toBe(12);
    });

    it("stores no capacity when the field is empty", async () => {
      await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, capacity: "" }, browser: true })
      );

      expect(lastCreateData().capacity).toBeNull();
    });

    it("rejects a non-positive capacity", async () => {
      const response = await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, capacity: 0 }, browser: true })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it("rejects a fractional capacity", async () => {
      const response = await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, capacity: 2.5 }, browser: true })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it("rejects a title that exceeds the length limit", async () => {
      const response = await POST(
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, title: "a".repeat(201) }, browser: true })
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
        apiRequest("POST", "/api/admin/events", { body: { ...validBody, [field]: value }, browser: true })
      );

      expect(response.status).toBe(400);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    const params = routeContext({ id: "event-1" });

    it("updates the title", async () => {
      const response = await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { title: "Neuer Titel" }, browser: true }),
        params
      );

      expect(response.status).toBe(200);
      expect(lastUpdateData().title).toBe("Neuer Titel");
    });

    it("clears the title when an empty value is sent", async () => {
      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { title: "" }, browser: true }),
        params
      );

      expect(lastUpdateData().title).toBeNull();
    });

    it("clears the cost note when an empty value is sent", async () => {
      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { cost: "" }, browser: true }),
        params
      );

      expect(lastUpdateData().cost).toBeNull();
    });

    it("clears the capacity when an empty value is sent", async () => {
      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { capacity: "" }, browser: true }),
        params
      );

      expect(lastUpdateData().capacity).toBeNull();
    });

    it.each([
      ["title", "titel"],
      ["cost", "kosten"],
    ])("clears %s when an explicit null is sent", async (field) => {
      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { [field]: null }, browser: true }),
        params
      );

      expect(lastUpdateData()[field]).toBeNull();
    });

    it("leaves the title untouched when the field is omitted", async () => {
      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { location: "Vereinsheim" }, browser: true }),
        params
      );

      expect(lastUpdateData()).not.toHaveProperty("title");
    });

    it("triggers immediate reminders when a hidden event becomes visible", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({ ...existingEvent, visibility: "HIDDEN" });

      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { visibility: "MEMBER" }, browser: true }),
        params
      );

      expect(triggerImmediateEventReminders).toHaveBeenCalledWith("event-1");
    });

    it("triggers immediate reminders when the event is rescheduled", async () => {
      await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { date: "2026-09-05" }, browser: true }),
        params
      );

      expect(triggerImmediateEventReminders).toHaveBeenCalledWith("event-1");
    });

    it("triggers immediate reminders when only the start time changes", async () => {
      const res = await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { timeFrom: "08:00", timeTo: "16:00" }, browser: true }),
        params
      );

      expect(res.status).toBe(200);
      expect(triggerImmediateEventReminders).toHaveBeenCalledWith("event-1");
    });

    it("does not trigger reminders for other changes or hidden events", async () => {
      const otherChange = await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", { body: { location: "Vereinsheim" }, browser: true }),
        params
      );
      const hiddenReschedule = await PUT(
        apiRequest("PUT", "/api/admin/events/event-1", {
          body: { date: "2026-09-05", visibility: "HIDDEN" },
          browser: true,
        }),
        params
      );

      expect(otherChange.status).toBe(200);
      expect(hiddenReschedule.status).toBe(200);
      expect(triggerImmediateEventReminders).not.toHaveBeenCalled();
    });
  });
});

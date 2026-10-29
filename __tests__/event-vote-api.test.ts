import { POST, DELETE } from "@/app/api/events/[id]/vote/route";
import { apiRequest, routeContext } from "./helpers/request";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/auth-utils", () => {
  const actual = jest.requireActual("@/lib/auth-utils");
  return {
    ...actual,
    requireMember: jest.fn(),
  };
});

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

jest.mock("@/lib/request-body-parser", () => {
  const actual = jest.requireActual("@/lib/request-body-parser");
  return {
    ...actual,
    parseJsonBody: jest.fn(async (req: Request) => req.json()),
  };
});

jest.mock("@/lib/csrf-validator", () => {
  const actual = jest.requireActual("@/lib/csrf-validator");
  return {
    ...actual,
    validateCsrfHeaders: jest.fn(),
  };
});

function createMockRequest(body?: Record<string, unknown>) {
  return apiRequest("POST", "/api/events/event-1/vote", { body: body ?? {} });
}

function ctx(id: string) {
  return routeContext({ id }) as never;
}

const member = { id: "user-1", email: "member@example.com", role: "MEMBER", name: "Mitglied" };
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe("/api/events/[id]/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMember as jest.Mock).mockResolvedValue(member);
  });

  describe("POST", () => {
    it("stores a valid Teilnahmeanmeldung via upsert", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: futureDate,
        visibility: "PUBLIC",
        createdById: "admin-1",
      });
      (prisma.vote.upsert as jest.Mock).mockResolvedValue({
        id: "vote-1",
        userId: "user-1",
        eventId: "event-1",
        vote: "JA",
      });

      const response = await POST(createMockRequest({ vote: "JA" }), ctx("event-1"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.vote).toBe("JA");
      expect(prisma.vote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_eventId: { userId: "user-1", eventId: "event-1" } },
          create: { userId: "user-1", eventId: "event-1", vote: "JA" },
          update: { vote: "JA" },
        })
      );
    });

    it("accepts a Teilnahmeanmeldung even when the capacity is exhausted", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: futureDate,
        visibility: "PUBLIC",
        createdById: "admin-1",
        capacity: 1,
      });
      (prisma.vote.upsert as jest.Mock).mockResolvedValue({
        id: "vote-2",
        userId: "user-1",
        eventId: "event-1",
        vote: "JA",
      });

      const response = await POST(createMockRequest({ vote: "JA" }), ctx("event-1"));

      expect(response.status).toBe(200);
      expect(prisma.vote.upsert).toHaveBeenCalled();
    });

    it("rejects invalid vote values with 400", async () => {
      const response = await POST(createMockRequest({ vote: "UNSINN" }), ctx("event-1"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("JA, NEIN, VIELLEICHT");
      expect(prisma.vote.upsert).not.toHaveBeenCalled();
    });

    it("rejects votes for past events with 409", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: pastDate,
        visibility: "PUBLIC",
        createdById: "admin-1",
      });

      const response = await POST(createMockRequest({ vote: "JA" }), ctx("event-1"));

      expect(response.status).toBe(409);
      expect(prisma.vote.upsert).not.toHaveBeenCalled();
    });

    it("hides invisible events from members (404)", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: futureDate,
        visibility: "HIDDEN",
        createdById: "admin-1",
      });

      const response = await POST(createMockRequest({ vote: "JA" }), ctx("event-1"));

      expect(response.status).toBe(404);
      expect(prisma.vote.upsert).not.toHaveBeenCalled();
    });

    it("returns 404 for a non-existent event", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await POST(createMockRequest({ vote: "JA" }), ctx("missing"));

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("removes an existing Teilnahmeanmeldung", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: futureDate,
        visibility: "PUBLIC",
        createdById: "admin-1",
      });
      (prisma.vote.findUnique as jest.Mock).mockResolvedValue({ id: "vote-1" });

      const response = await DELETE(createMockRequest(), ctx("event-1"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.vote.delete).toHaveBeenCalledWith({ where: { id: "vote-1" } });
    });

    it("returns 404 when no Teilnahmeanmeldung exists", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: futureDate,
        visibility: "PUBLIC",
        createdById: "admin-1",
      });
      (prisma.vote.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await DELETE(createMockRequest(), ctx("event-1"));

      expect(response.status).toBe(404);
      expect(prisma.vote.delete).not.toHaveBeenCalled();
    });

    it("rejects withdrawal for past events with 409", async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-1",
        date: pastDate,
        visibility: "PUBLIC",
        createdById: "admin-1",
      });

      const response = await DELETE(createMockRequest(), ctx("event-1"));

      expect(response.status).toBe(409);
      expect(prisma.vote.delete).not.toHaveBeenCalled();
    });
  });
});

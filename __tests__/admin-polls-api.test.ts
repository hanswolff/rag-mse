import { NextRequest } from "next/server";
import { GET as listPolls, POST as createPoll } from "@/app/api/admin/polls/route";
import {
  GET as getPoll,
  PATCH as updatePoll,
  DELETE as deletePoll,
} from "@/app/api/admin/polls/[id]/route";
import { POST as publishPoll } from "@/app/api/admin/polls/[id]/publish/route";
import { POST as closePoll } from "@/app/api/admin/polls/[id]/close/route";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateCsrfHeaders } from "@/lib/api-utils";
import { sendTemplateEmail } from "@/lib/email-sender";
import { generateUniquePollId } from "@/lib/poll-utils";
import { validateCreatePollRequest, validateUpdatePollRequest } from "@/lib/poll-validation";

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    poll: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    pollOption: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    pollVote: {
      deleteMany: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    pollNotificationDispatch: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/api-utils", () => ({
  parseJsonBody: jest.fn(async (req) => req.json()),
  validateCsrfHeaders: jest.fn(),
  withApiErrorHandling: jest.fn((handler) => handler),
  validateRequestBody: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  getAuthNoCacheHeaders: jest.fn(() => ({})),
}));

jest.mock("@/lib/email-sender", () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/poll-validation", () => ({
  validateCreatePollRequest: jest.fn(),
  validateUpdatePollRequest: jest.fn(),
}));

jest.mock("@/lib/poll-utils", () => ({
  generateUniquePollId: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
  logResourceNotFound: jest.fn(),
}));

const mockRequireAdmin = requireAdmin as jest.Mock;
const mockPollFindMany = prisma.poll.findMany as jest.Mock;
const mockPollFindUnique = prisma.poll.findUnique as jest.Mock;
const mockPollCreate = prisma.poll.create as jest.Mock;
const mockPollUpdate = prisma.poll.update as jest.Mock;
const mockPollDelete = prisma.poll.delete as jest.Mock;
const mockPollCount = prisma.poll.count as jest.Mock;
const mockPollOptionDeleteMany = prisma.pollOption.deleteMany as jest.Mock;
const mockPollOptionCreateMany = prisma.pollOption.createMany as jest.Mock;
const mockEventFindUnique = (prisma as unknown as { event: { findUnique: jest.Mock } }).event.findUnique;
const mockUserFindMany = prisma.user.findMany as jest.Mock;
const mockPollNotificationCreate = (prisma as unknown as { pollNotificationDispatch: { create: jest.Mock } }).pollNotificationDispatch.create;
const mockSendTemplateEmail = sendTemplateEmail as jest.Mock;
const mockGeneratePollId = generateUniquePollId as jest.Mock;
const mockValidateCreate = validateCreatePollRequest as jest.Mock;
const mockValidateUpdate = validateUpdatePollRequest as jest.Mock;
const mockValidateCsrf = validateCsrfHeaders as jest.Mock;

const adminUser = { id: "admin-1", role: "ADMIN", name: "Admin" };

function idContext(id: string) {
  return { params: Promise.resolve({ id }) } as never;
}

const mockTransaction = (prisma as unknown as { $transaction: jest.Mock }).$transaction;

describe("/api/admin/polls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(adminUser);
    mockValidateCreate.mockReturnValue({ isValid: true, errors: [] });
    mockValidateUpdate.mockReturnValue({ isValid: true, errors: [] });
    mockGeneratePollId.mockResolvedValue("abc12345");
    // Interaktive Transaktionen führen den Callback gegen das gemockte prisma aus.
    mockTransaction.mockImplementation(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: typeof prisma) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[])
    );
  });

  describe("GET /api/admin/polls (list)", () => {
    it("returns paginated polls", async () => {
      const polls = [
        { id: "p1", title: "Poll 1", status: "DRAFT", options: [], _count: { votes: 0 }, event: null },
        { id: "p2", title: "Poll 2", status: "LIVE", options: [], _count: { votes: 3 }, event: null },
      ];
      mockPollFindMany.mockResolvedValueOnce(polls);
      mockPollCount.mockResolvedValueOnce(2);

      const request = new NextRequest("http://localhost:3000/api/admin/polls?page=1&limit=10");
      const response = await listPolls(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.polls).toHaveLength(2);
      expect(json.pagination).toEqual({ total: 2, page: 1, limit: 10, pages: 1 });
    });

    it("returns empty list when no polls exist", async () => {
      mockPollFindMany.mockResolvedValueOnce([]);
      mockPollCount.mockResolvedValueOnce(0);

      const request = new NextRequest("http://localhost:3000/api/admin/polls");
      const response = await listPolls(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.polls).toEqual([]);
      expect(json.pagination.total).toBe(0);
    });

    it("calls requireAdmin with read permission", async () => {
      mockPollFindMany.mockResolvedValueOnce([]);
      mockPollCount.mockResolvedValueOnce(0);

      const request = new NextRequest("http://localhost:3000/api/admin/polls");
      await listPolls(request);

      expect(mockRequireAdmin).toHaveBeenCalledWith("read");
    });
  });

  describe("POST /api/admin/polls (create)", () => {
    it("creates a SONSTIGES poll with options", async () => {
      const createdPoll = {
        id: "p-new",
        title: "Test Poll",
        description: null,
        type: "SONSTIGES",
        status: "DRAFT",
        multipleChoice: false,
        eventId: null,
        options: [
          { id: "opt-1", text: "Option A", position: 0 },
          { id: "opt-2", text: "Option B", position: 1 },
        ],
      };
      mockPollCreate.mockResolvedValueOnce(createdPoll);

      const request = new NextRequest("http://localhost:3000/api/admin/polls", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Poll",
          type: "SONSTIGES",
          options: [{ text: "Option A" }, { text: "Option B" }],
        }),
      });

      const response = await createPoll(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.title).toBe("Test Poll");
      expect(json.options).toHaveLength(2);
      expect(mockPollCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: "abc12345",
            title: "Test Poll",
            type: "SONSTIGES",
            eventId: null,
            createdById: "admin-1",
          }),
        })
      );
    });

    it("creates a TERMIN poll with eventId", async () => {
      mockEventFindUnique.mockResolvedValueOnce({ id: "event-1" });
      const createdPoll = {
        id: "p-termin",
        title: "Termin Poll",
        type: "TERMIN",
        eventId: "event-1",
        options: [
          { id: "opt-1", text: "Ja", position: 0 },
          { id: "opt-2", text: "Nein", position: 1 },
        ],
      };
      mockPollCreate.mockResolvedValueOnce(createdPoll);

      const request = new NextRequest("http://localhost:3000/api/admin/polls", {
        method: "POST",
        body: JSON.stringify({
          title: "Termin Poll",
          type: "TERMIN",
          eventId: "event-1",
          options: [{ text: "Ja" }, { text: "Nein" }],
        }),
      });

      const response = await createPoll(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.type).toBe("TERMIN");
      expect(json.eventId).toBe("event-1");
    });

    it("validates CSRF headers", async () => {
      mockPollCreate.mockResolvedValueOnce({ id: "p1", options: [] });

      const request = new NextRequest("http://localhost:3000/api/admin/polls", {
        method: "POST",
        body: JSON.stringify({
          title: "X",
          type: "SONSTIGES",
          options: [{ text: "A" }, { text: "B" }],
        }),
      });

      await createPoll(request);

      expect(mockValidateCsrf).toHaveBeenCalledWith(request);
    });

    it("calls requireAdmin with write permission", async () => {
      mockPollCreate.mockResolvedValueOnce({ id: "p1", options: [] });

      const request = new NextRequest("http://localhost:3000/api/admin/polls", {
        method: "POST",
        body: JSON.stringify({
          title: "X",
          type: "SONSTIGES",
          options: [{ text: "A" }, { text: "B" }],
        }),
      });

      await createPoll(request);

      expect(mockRequireAdmin).toHaveBeenCalledWith("write");
    });

    it("returns 400 for invalid data", async () => {
      mockValidateCreate.mockReturnValueOnce({
        isValid: false,
        errors: ["Titel ist erforderlich"],
      });

      const request = new NextRequest("http://localhost:3000/api/admin/polls", {
        method: "POST",
        body: JSON.stringify({ title: "", type: "SONSTIGES", options: [] }),
      });

      const response = await createPoll(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Titel ist erforderlich");
    });

    it("returns 404 for TERMIN poll with non-existent event", async () => {
      mockEventFindUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/admin/polls", {
        method: "POST",
        body: JSON.stringify({
          title: "Termin",
          type: "TERMIN",
          eventId: "missing-event",
          options: [{ text: "A" }, { text: "B" }],
        }),
      });

      const response = await createPoll(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Termin nicht gefunden");
    });
  });

  describe("GET /api/admin/polls/[id] (detail)", () => {
    it("returns poll with options and vote counts", async () => {
      const poll = {
        id: "p1",
        title: "Test Poll",
        status: "LIVE",
        options: [
          { id: "opt-1", text: "A", position: 0, _count: { votes: 2 } },
          { id: "opt-2", text: "B", position: 1, _count: { votes: 1 } },
        ],
        _count: { votes: 3 },
        event: null,
        votes: [
          { user: { id: "u1", name: "Max", email: "max@test.de" }, option: { id: "opt-1", text: "A" } },
        ],
      };
      mockPollFindUnique.mockResolvedValueOnce(poll);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1");
      const response = await getPoll(request, idContext("p1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.id).toBe("p1");
      expect(json.options).toHaveLength(2);
      expect(json._count.votes).toBe(3);
    });

    it("returns 404 for non-existent poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/missing");
      const response = await getPoll(request, idContext("missing"));

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Umfrage nicht gefunden");
    });
  });

  describe("PATCH /api/admin/polls/[id] (update)", () => {
    it("updates title and description", async () => {
      mockPollFindUnique.mockResolvedValue({ id: "p1", status: "DRAFT" });
      const updatedPoll = {
        id: "p1",
        title: "Updated Title",
        description: "New desc",
        options: [{ id: "opt-1", text: "A", position: 0 }],
      };
      mockPollUpdate.mockResolvedValueOnce(updatedPoll);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Title", description: "New desc" }),
      });

      const response = await updatePoll(request, idContext("p1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.title).toBe("Updated Title");
      expect(json.description).toBe("New desc");
    });

    it("replaces options when provided", async () => {
      mockPollFindUnique.mockResolvedValue({ id: "p1", status: "DRAFT" });
      mockPollUpdate.mockResolvedValueOnce({
        id: "p1",
        options: [
          { id: "new-1", text: "X", position: 0 },
          { id: "new-2", text: "Y", position: 1 },
        ],
      });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1", {
        method: "PATCH",
        body: JSON.stringify({ options: [{ text: "X" }, { text: "Y" }] }),
      });

      const response = await updatePoll(request, idContext("p1"));

      expect(response.status).toBe(200);
      expect(mockPollOptionDeleteMany).toHaveBeenCalledWith({ where: { pollId: "p1" } });
      expect(mockPollOptionCreateMany).toHaveBeenCalledWith({
        data: [
          { pollId: "p1", text: "X", position: 0 },
          { pollId: "p1", text: "Y", position: 1 },
        ],
      });
    });

    it("returns 409 for non-DRAFT poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce({ id: "p1", status: "LIVE" });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Update" }),
      });

      const response = await updatePoll(request, idContext("p1"));

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain("Entwurfsstatus");
    });

    it("returns 404 for non-existent poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/missing", {
        method: "PATCH",
        body: JSON.stringify({ title: "Update" }),
      });

      const response = await updatePoll(request, idContext("missing"));

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Umfrage nicht gefunden");
    });

    it("returns 409 and keeps options when the poll goes LIVE between check and update", async () => {
      // Vorab-Check sieht noch DRAFT, in der Transaktion ist die Umfrage bereits LIVE
      // (gleichzeitiges Publish). Optionen und Stimmen dürfen nicht gelöscht werden.
      mockPollFindUnique
        .mockResolvedValueOnce({ id: "p1", status: "DRAFT" })
        .mockResolvedValueOnce({ id: "p1", status: "LIVE" });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1", {
        method: "PATCH",
        body: JSON.stringify({ options: [{ text: "X" }] }),
      });

      const response = await updatePoll(request, idContext("p1"));

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain("Entwurfsstatus");
      expect(mockPollOptionDeleteMany).not.toHaveBeenCalled();
      expect(mockPollOptionCreateMany).not.toHaveBeenCalled();
      expect(mockPollUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/admin/polls/[id]", () => {
    it("deletes poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce({ id: "p1" });
      mockPollDelete.mockResolvedValueOnce({ id: "p1" });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1", {
        method: "DELETE",
      });

      const response = await deletePoll(request, idContext("p1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockPollDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    });

    it("returns 404 for non-existent poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/missing", {
        method: "DELETE",
      });

      const response = await deletePoll(request, idContext("missing"));

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Umfrage nicht gefunden");
    });
  });

  describe("POST /api/admin/polls/[id]/publish", () => {
    it("publishes DRAFT poll to LIVE with matching poll ID shortCode", async () => {
      const draftPoll = {
        id: "abc12345",
        title: "Draft Poll",
        description: "A poll",
        status: "DRAFT",
        options: [{ id: "opt-1" }, { id: "opt-2" }],
      };
      const publishedPoll = {
        id: "abc12345",
        title: "Draft Poll",
        status: "LIVE",
        shortCode: "abc12345",
        options: [
          { id: "opt-1", text: "A", position: 0 },
          { id: "opt-2", text: "B", position: 1 },
        ],
      };
      mockPollFindUnique.mockResolvedValueOnce(draftPoll);
      mockPollUpdate.mockResolvedValueOnce(publishedPoll);
      mockUserFindMany.mockResolvedValueOnce([]);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/abc12345/publish", {
        method: "POST",
      });

      const response = await publishPoll(request, idContext("abc12345"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.shortCode).toBe("abc12345");
      expect(json.pollUrl).toContain("/u/abc12345");
      expect(mockPollUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "abc12345" },
          data: { status: "LIVE", shortCode: "abc12345" },
        })
      );
    });

    it("sends notification emails to members with pollNotificationEnabled", async () => {
      const draftPoll = {
        id: "abc12345",
        title: "Notification Poll",
        description: "Test desc",
        status: "DRAFT",
        options: [{ id: "opt-1" }, { id: "opt-2" }],
      };
      mockPollFindUnique.mockResolvedValueOnce(draftPoll);
      mockPollUpdate.mockResolvedValueOnce({ ...draftPoll, status: "LIVE", shortCode: "abc12345" });
      mockUserFindMany.mockResolvedValueOnce([
        { id: "u1", name: "Max", email: "max@test.de" },
        { id: "u2", name: "Eva", email: "eva@test.de" },
      ]);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/abc12345/publish", {
        method: "POST",
      });

      await publishPoll(request, idContext("abc12345"));

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pollNotificationEnabled: true, activatedAt: { not: null } },
        })
      );
      expect(mockSendTemplateEmail).toHaveBeenCalledTimes(2);
      expect(mockSendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "umfrage-benachrichtigung",
          to: ["max@test.de"],
        })
      );
      expect(mockPollNotificationCreate).toHaveBeenCalledTimes(2);
    });

    it("returns 400 for non-DRAFT poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce({
        id: "p1",
        status: "LIVE",
        options: [{ id: "opt-1" }, { id: "opt-2" }],
      });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1/publish", {
        method: "POST",
      });

      const response = await publishPoll(request, idContext("p1"));

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain("Entwurfsstatus");
    });

    it("returns 404 for non-existent poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/missing/publish", {
        method: "POST",
      });

      const response = await publishPoll(request, idContext("missing"));

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Umfrage nicht gefunden");
    });

    it("returns 400 for poll with fewer than 2 options", async () => {
      mockPollFindUnique.mockResolvedValueOnce({
        id: "p1",
        status: "DRAFT",
        options: [{ id: "opt-1" }],
      });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1/publish", {
        method: "POST",
      });

      const response = await publishPoll(request, idContext("p1"));

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Mindestens 2 Optionen");
    });
  });

  describe("POST /api/admin/polls/[id]/close", () => {
    it("closes LIVE poll to CLOSED", async () => {
      mockPollFindUnique.mockResolvedValueOnce({ id: "p1", status: "LIVE" });
      const closedPoll = {
        id: "p1",
        status: "CLOSED",
        options: [
          { id: "opt-1", text: "A", position: 0 },
          { id: "opt-2", text: "B", position: 1 },
        ],
      };
      mockPollUpdate.mockResolvedValueOnce(closedPoll);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1/close", {
        method: "POST",
      });

      const response = await closePoll(request, idContext("p1"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("CLOSED");
      expect(mockPollUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1" },
          data: { status: "CLOSED" },
        })
      );
    });

    it("returns 409 for non-LIVE poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce({ id: "p1", status: "DRAFT" });

      const request = new NextRequest("http://localhost:3000/api/admin/polls/p1/close", {
        method: "POST",
      });

      const response = await closePoll(request, idContext("p1"));

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain("aktive Umfragen");
    });

    it("returns 404 for non-existent poll", async () => {
      mockPollFindUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/admin/polls/missing/close", {
        method: "POST",
      });

      const response = await closePoll(request, idContext("missing"));

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Umfrage nicht gefunden");
    });
  });
});

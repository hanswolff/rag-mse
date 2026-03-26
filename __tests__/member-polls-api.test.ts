import { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { validateCsrfHeaders } from "@/lib/api-utils";
import { validateVoteRequest } from "@/lib/poll-validation";

jest.mock("@/lib/auth-utils", () => ({
  requireMember: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    poll: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    pollVote: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
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

jest.mock("@/lib/poll-validation", () => ({
  validateVoteRequest: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logResourceNotFound: jest.fn(),
  logValidationFailure: jest.fn(),
}));

const mockRequireMember = requireMember as jest.Mock;
const mockPollFindMany = prisma.poll.findMany as jest.Mock;
const mockPollFindUnique = prisma.poll.findUnique as jest.Mock;
const mockPollCount = prisma.poll.count as jest.Mock;
const mockPollVoteDeleteMany = prisma.pollVote.deleteMany as jest.Mock;
const mockPollVoteCreateMany = prisma.pollVote.createMany as jest.Mock;
const mockValidateCsrf = validateCsrfHeaders as jest.Mock;
const mockValidateVoteRequest = validateVoteRequest as jest.Mock;

const BASE_URL = "http://localhost:3000";
const TEST_USER = { id: "user-1", email: "test@example.com", role: "MEMBER" };

function makePoll(overrides: Record<string, unknown> = {}) {
  return {
    id: "poll-1",
    title: "Test Poll",
    status: "LIVE",
    type: "SONSTIGES",
    multipleChoice: false,
    createdAt: new Date("2024-01-01"),
    options: [
      { id: "opt-1", label: "Ja", position: 0, _count: { votes: 1 } },
      { id: "opt-2", label: "Nein", position: 1, _count: { votes: 0 } },
    ],
    _count: { votes: 1 },
    votes: [{ optionId: "opt-1" }],
    event: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireMember.mockResolvedValue(TEST_USER);
});

describe("GET /api/polls", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/polls/route"));
  });

  it("calls requireMember", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls`));

    expect(mockRequireMember).toHaveBeenCalled();
  });

  it("returns LIVE polls for member", async () => {
    const poll = makePoll();
    mockPollFindMany.mockResolvedValue([poll]);
    mockPollCount.mockResolvedValue(1);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls`));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.polls).toHaveLength(1);
    expect(data.polls[0].id).toBe("poll-1");

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE" } }),
    );
  });

  it("includes userVoteOptionIds mapped from votes", async () => {
    const poll = makePoll({ votes: [{ optionId: "opt-1" }] });
    mockPollFindMany.mockResolvedValue([poll]);
    mockPollCount.mockResolvedValue(1);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls`));
    const data = await res.json();

    expect(data.polls[0].userVoteOptionIds).toEqual(["opt-1"]);
    expect(data.polls[0]).not.toHaveProperty("votes");
  });

  it("supports type filter TERMIN", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?type=TERMIN`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE", type: "TERMIN" } }),
    );
  });

  it("supports eventId filter", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?type=TERMIN&eventId=event-42`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE", type: "TERMIN", eventId: "event-42" } }),
    );
  });

  it("supports type filter SONSTIGES", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?type=SONSTIGES`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE", type: "SONSTIGES" } }),
    );
  });

  it("ignores invalid type filter", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?type=INVALID`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE" } }),
    );
  });

  it("supports pagination", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(25);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls?page=2&limit=10`));
    const data = await res.json();

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(data.pagination).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      pages: 3,
    });
  });

  it("defaults to page 1 and limit 20", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls`));
    const data = await res.json();

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(20);
  });

  it("supports status filter with multiple values", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?status=LIVE,CLOSED`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["LIVE", "CLOSED"] } } }),
    );
  });

  it("supports single status filter", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?status=CLOSED`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "CLOSED" } }),
    );
  });

  it("ignores invalid status values", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?status=DRAFT,INVALID`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE" } }),
    );
  });

  it("supports after date filter", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?after=2024-06-01T00:00:00.000Z`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "LIVE", createdAt: { gte: new Date("2024-06-01T00:00:00.000Z") } },
      }),
    );
  });

  it("supports before date filter", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?before=2024-06-01T00:00:00.000Z`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "LIVE", createdAt: { lt: new Date("2024-06-01T00:00:00.000Z") } },
      }),
    );
  });

  it("supports combined before and after date filters", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?after=2024-01-01T00:00:00.000Z&before=2024-07-01T00:00:00.000Z`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "LIVE",
          createdAt: {
            gte: new Date("2024-01-01T00:00:00.000Z"),
            lt: new Date("2024-07-01T00:00:00.000Z"),
          },
        },
      }),
    );
  });

  it("ignores invalid date values", async () => {
    mockPollFindMany.mockResolvedValue([]);
    mockPollCount.mockResolvedValue(0);

    await GET(new NextRequest(`${BASE_URL}/api/polls?after=not-a-date&before=also-invalid`));

    expect(mockPollFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "LIVE" } }),
    );
  });
});

describe("GET /api/polls/[id]", () => {
  let GET: (req: NextRequest, ctx: never) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/polls/[id]/route"));
  });

  function ctx(id = "poll-1") {
    return { params: Promise.resolve({ id }) } as never;
  }

  it("returns poll detail with options, vote counts, and userVoteOptionIds", async () => {
    const poll = makePoll();
    mockPollFindUnique.mockResolvedValue(poll);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls/poll-1`), ctx());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("poll-1");
    expect(data.options).toHaveLength(2);
    expect(data.options[0]._count.votes).toBe(1);
    expect(data._count.votes).toBe(1);
    expect(data.userVoteOptionIds).toEqual(["opt-1"]);
    expect(data).not.toHaveProperty("votes");
  });

  it("returns 404 for non-existent poll", async () => {
    mockPollFindUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls/nope`), ctx("nope"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("returns 404 for DRAFT poll", async () => {
    const draft = makePoll({ status: "DRAFT" });
    mockPollFindUnique.mockResolvedValue(draft);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls/poll-1`), ctx());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("returns CLOSED poll detail", async () => {
    const closed = makePoll({ status: "CLOSED" });
    mockPollFindUnique.mockResolvedValue(closed);

    const res = await GET(new NextRequest(`${BASE_URL}/api/polls/poll-1`), ctx());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("poll-1");
  });
});

describe("POST /api/polls/[id]/vote", () => {
  let POST: (req: NextRequest, ctx: never) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/polls/[id]/vote/route"));
  });

  function ctx(id = "poll-1") {
    return { params: Promise.resolve({ id }) } as never;
  }

  function makeVoteRequest(body: unknown) {
    return new NextRequest(`${BASE_URL}/api/polls/poll-1/vote`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("validates CSRF headers", async () => {
    const poll = makePoll({ options: [{ id: "opt-1" }] });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({ isValid: true, errors: [] });

    await POST(makeVoteRequest({ optionIds: ["opt-1"] }), ctx());

    expect(mockValidateCsrf).toHaveBeenCalled();
  });

  it("casts a single-choice vote", async () => {
    const poll = makePoll({
      multipleChoice: false,
      options: [{ id: "opt-1" }, { id: "opt-2" }],
    });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({ isValid: true, errors: [] });

    const res = await POST(makeVoteRequest({ optionIds: ["opt-1"] }), ctx());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.optionIds).toEqual(["opt-1"]);

    expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
      where: { pollId: "poll-1", userId: TEST_USER.id },
    });
    expect(mockPollVoteCreateMany).toHaveBeenCalledWith({
      data: [{ pollId: "poll-1", optionId: "opt-1", userId: TEST_USER.id }],
    });
  });

  it("casts a multiple-choice vote", async () => {
    const poll = makePoll({
      multipleChoice: true,
      options: [{ id: "opt-1" }, { id: "opt-2" }, { id: "opt-3" }],
    });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({ isValid: true, errors: [] });

    const res = await POST(
      makeVoteRequest({ optionIds: ["opt-1", "opt-3"] }),
      ctx(),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.optionIds).toEqual(["opt-1", "opt-3"]);
    expect(mockPollVoteCreateMany).toHaveBeenCalledWith({
      data: [
        { pollId: "poll-1", optionId: "opt-1", userId: TEST_USER.id },
        { pollId: "poll-1", optionId: "opt-3", userId: TEST_USER.id },
      ],
    });
  });

  it("returns 400 for invalid optionIds", async () => {
    const poll = makePoll({ options: [{ id: "opt-1" }] });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({ isValid: true, errors: [] });

    const res = await POST(makeVoteRequest({ optionIds: ["bad-id"] }), ctx());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Ungültige Options-ID");
  });

  it("returns 409 for CLOSED poll", async () => {
    const poll = makePoll({ status: "CLOSED" });
    mockPollFindUnique.mockResolvedValue(poll);

    const res = await POST(makeVoteRequest({ optionIds: ["opt-1"] }), ctx());
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBeDefined();
  });

  it("returns 404 for non-existent poll", async () => {
    mockPollFindUnique.mockResolvedValue(null);

    const res = await POST(makeVoteRequest({ optionIds: ["opt-1"] }), ctx());

    expect(res.status).toBe(404);
  });

  it("returns 400 when validation fails (e.g. multiple options on single-choice)", async () => {
    const poll = makePoll({
      multipleChoice: false,
      options: [{ id: "opt-1" }, { id: "opt-2" }],
    });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({
      isValid: false,
      errors: ["Bei Einzelauswahl darf nur eine Option gewählt werden"],
    });

    const res = await POST(
      makeVoteRequest({ optionIds: ["opt-1", "opt-2"] }),
      ctx(),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Einzelauswahl");
  });

  it("returns 400 for duplicate optionIds", async () => {
    const poll = makePoll({
      multipleChoice: true,
      options: [{ id: "opt-1" }, { id: "opt-2" }],
    });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({
      isValid: false,
      errors: ["Jede Option darf nur einmal gewählt werden"],
    });

    const res = await POST(
      makeVoteRequest({ optionIds: ["opt-1", "opt-1"] }),
      ctx(),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Jede Option darf nur einmal gewählt werden");
    expect(mockPollVoteCreateMany).not.toHaveBeenCalled();
  });

  it("deletes existing votes before creating new ones", async () => {
    const poll = makePoll({ options: [{ id: "opt-1" }] });
    mockPollFindUnique.mockResolvedValue(poll);
    mockValidateVoteRequest.mockReturnValue({ isValid: true, errors: [] });

    await POST(makeVoteRequest({ optionIds: ["opt-1"] }), ctx());

    const deleteOrder = mockPollVoteDeleteMany.mock.invocationCallOrder[0];
    const createOrder = mockPollVoteCreateMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });
});

describe("DELETE /api/polls/[id]/vote", () => {
  let DELETE: (req: NextRequest, ctx: never) => Promise<Response>;

  beforeAll(async () => {
    ({ DELETE } = await import("@/app/api/polls/[id]/vote/route"));
  });

  function ctx(id = "poll-1") {
    return { params: Promise.resolve({ id }) } as never;
  }

  function makeDeleteRequest() {
    return new NextRequest(`${BASE_URL}/api/polls/poll-1/vote`, {
      method: "DELETE",
    });
  }

  it("validates CSRF headers", async () => {
    mockPollFindUnique.mockResolvedValue({ id: "poll-1", status: "LIVE" });

    await DELETE(makeDeleteRequest(), ctx());

    expect(mockValidateCsrf).toHaveBeenCalled();
  });

  it("removes all votes for user on poll", async () => {
    mockPollFindUnique.mockResolvedValue({ id: "poll-1", status: "LIVE" });

    const res = await DELETE(makeDeleteRequest(), ctx());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPollVoteDeleteMany).toHaveBeenCalledWith({
      where: { pollId: "poll-1", userId: TEST_USER.id },
    });
  });

  it("returns 409 for CLOSED poll", async () => {
    mockPollFindUnique.mockResolvedValue({ id: "poll-1", status: "CLOSED" });

    const res = await DELETE(makeDeleteRequest(), ctx());
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBeDefined();
  });

  it("returns 404 for non-existent poll", async () => {
    mockPollFindUnique.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), ctx());

    expect(res.status).toBe(404);
  });
});

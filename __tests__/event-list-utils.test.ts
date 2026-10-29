import { countVotes, getVoteLabel, loadEventListPage, parsePageParam } from "@/lib/event-list-utils";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

describe("parsePageParam", () => {
  it("parses valid page numbers", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("falls back to 1 for missing or invalid values", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-2")).toBe(1);
  });
});

describe("countVotes", () => {
  it("counts member and guest registrations into vote buckets", () => {
    const counts = countVotes(
      [{ vote: "JA" }, { vote: "JA" }, { vote: "VIELLEICHT" }],
      [{ vote: "JA" }, { vote: "NEIN" }]
    );

    expect(counts).toEqual({ JA: 3, NEIN: 1, VIELLEICHT: 1 });
  });

  it("returns zeroed buckets when nothing is registered", () => {
    expect(countVotes(undefined, undefined)).toEqual({ JA: 0, NEIN: 0, VIELLEICHT: 0 });
    expect(countVotes([], [])).toEqual({ JA: 0, NEIN: 0, VIELLEICHT: 0 });
  });
});

describe("getVoteLabel", () => {
  it("shows the occupancy when a capacity is set", () => {
    const label = getVoteLabel({
      capacity: 10,
      votes: [{ vote: "JA" }, { vote: "VIELLEICHT" }],
      guestRegistrations: [{ vote: "JA" }],
    });

    expect(label).toContain("von 10");
  });

  it("shows the plain registration count without a capacity", () => {
    const label = getVoteLabel({
      votes: [{ vote: "JA" }],
      guestRegistrations: [],
    });

    expect(label).not.toContain("belegt");
  });
});

describe("loadEventListPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.event.count as jest.Mock).mockResolvedValue(0);
    (prisma.shootingRange.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("queries upcoming events ascending from today", async () => {
    await loadEventListPage({ direction: "upcoming", page: undefined, session: null });

    const args = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.date).toEqual({ gte: expect.any(Date) });
    expect(args.orderBy).toEqual([{ date: "asc" }, { timeFrom: "asc" }]);
    expect(args.where.visibility).toEqual({ in: ["PUBLIC"] });
    expect(args.select.votes).toBeUndefined();
  });

  it("queries past events descending before today", async () => {
    await loadEventListPage({ direction: "past", page: undefined, session: null });

    const args = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.date).toEqual({ lt: expect.any(Date) });
    expect(args.orderBy).toEqual([{ date: "desc" }, { timeFrom: "desc" }]);
  });

  it("includes registrations in the select for logged-in users", async () => {
    await loadEventListPage({
      direction: "upcoming",
      page: undefined,
      session: { user: { id: "m1", role: "MEMBER" } } as never,
    });

    const args = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
    expect(args.select.votes).toEqual({ select: { vote: true } });
    expect(args.select.guestRegistrations).toEqual({ select: { vote: true } });
  });

  it("applies pagination and returns at least one page", async () => {
    (prisma.event.count as jest.Mock).mockResolvedValue(41);

    const result = await loadEventListPage({ direction: "upcoming", page: "3", session: null });

    const args = (prisma.event.findMany as jest.Mock).mock.calls[0][0];
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(result.currentPage).toBe(3);
    expect(result.totalPages).toBe(3);

    (prisma.event.count as jest.Mock).mockResolvedValue(0);
    const empty = await loadEventListPage({ direction: "upcoming", page: undefined, session: null });
    expect(empty.totalPages).toBe(1);
  });

  it("builds a range lookup for locations that reference a shooting range", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      { id: "e1", location: "Stand A" },
      { id: "e2", location: "Stand A" },
    ]);
    (prisma.event.count as jest.Mock).mockResolvedValue(2);
    (prisma.shootingRange.findMany as jest.Mock).mockResolvedValue([
      { name: "Stand A", street: "Weg 1", postalCode: "17033", city: "Neubrandenburg" },
    ]);

    const result = await loadEventListPage({ direction: "upcoming", page: undefined, session: null });

    expect(prisma.shootingRange.findMany).toHaveBeenCalledWith({
      where: { name: { in: ["Stand A"] } },
      select: { name: true, street: true, postalCode: true, city: true },
    });
    expect(result.rangeLookup.get("stand a")).toBeDefined();
  });
});

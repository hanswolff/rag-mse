import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/role-utils";
import { withApiErrorHandling, getAuthNoCacheHeaders } from "@/lib/api-utils";
import { formatDateForStorage, getStartOfToday } from "@/lib/date-picker-utils";
import { VoteType } from "@prisma/client";

const MAX_PAGE_SIZE = 50;

function parsePageSize(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parsePageNumber(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function buildVisibilityFilter(userId: string | undefined, canSeeAll: boolean) {
  if (canSeeAll) return {};
  if (userId) return { OR: [{ visible: true }, { createdById: userId }] };
  return { visible: true };
}

const BASE_EVENT_SELECT = {
  id: true,
  date: true,
  timeFrom: true,
  timeTo: true,
  location: true,
  description: true,
  latitude: true,
  longitude: true,
  type: true,
  visible: true,
  createdAt: true,
  updatedAt: true,
} as const;

function getEventSelect(isAuthenticated: boolean) {
  if (!isAuthenticated) return BASE_EVENT_SELECT;
  return {
    ...BASE_EVENT_SELECT,
    _count: {
      select: { votes: true },
    },
    votes: {
      select: { vote: true },
    },
    guestRegistrations: {
      select: { vote: true },
    },
  } as const;
}

function formatEvents(events: Array<{ date: Date } & Record<string, unknown>>) {
  return events.map(event => ({
    ...event,
    date: formatDateForStorage(event.date),
  }));
}

type EventWithVotes = {
  date: Date;
  votes: { vote: VoteType }[];
  guestRegistrations: { vote: VoteType }[];
} & Record<string, unknown>;

function addVoteCountsToEvents(events: EventWithVotes[]) {
  return events.map(({ votes, guestRegistrations, ...event }) => {
    const voteCounts = votes.reduce(
      (acc, { vote }) => ({ ...acc, [vote]: acc[vote] + 1 }),
      { JA: 0, NEIN: 0, VIELLEICHT: 0 }
    );

    for (const guest of guestRegistrations ?? []) {
      voteCounts[guest.vote] += 1;
    }

    return {
      ...event,
      voteCounts,
    };
  });
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const pastPage = parsePageNumber(searchParams.get("pastPage"));
  const limit = parsePageSize(searchParams.get("limit"), 20);
  const skip = (page - 1) * limit;
  const pastSkip = (pastPage - 1) * limit;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const isAuthenticated = !!userId;
  const canSeeAll = isAdmin(session?.user);
  const eventSelect = getEventSelect(isAuthenticated);

  const visibilityFilter = buildVisibilityFilter(userId, canSeeAll);
  const currentStart = getStartOfToday();

  const [events, total, pastEvents, pastTotal] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "asc" },
      skip,
      take: limit,
      where: {
        ...visibilityFilter,
        date: { gte: currentStart },
      },
      select: eventSelect,
    }),
    prisma.event.count({
      where: {
        ...visibilityFilter,
        date: { gte: currentStart },
      },
    }),
    prisma.event.findMany({
      orderBy: { date: "desc" },
      skip: pastSkip,
      take: limit,
      where: {
        ...visibilityFilter,
        date: { lt: currentStart },
      },
      select: eventSelect,
    }),
    prisma.event.count({
      where: {
        ...visibilityFilter,
        date: { lt: currentStart },
      },
    }),
  ]);

  const eventsWithVoteCounts = isAuthenticated
    ? addVoteCountsToEvents(events as unknown as EventWithVotes[])
    : events;
  const pastEventsWithVoteCounts = isAuthenticated
    ? addVoteCountsToEvents(pastEvents as unknown as EventWithVotes[])
    : pastEvents;

  return NextResponse.json({
    events: formatEvents(eventsWithVoteCounts as Array<{ date: Date } & Record<string, unknown>>),
    pastEvents: formatEvents(pastEventsWithVoteCounts as Array<{ date: Date } & Record<string, unknown>>),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    pastPagination: {
      total: pastTotal,
      page: pastPage,
      limit,
      pages: Math.ceil(pastTotal / limit),
    },
  }, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/events", method: "GET" });

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessAdminArea } from "@/lib/role-utils";
import { withApiErrorHandling, getAuthNoCacheHeaders, getPublicCacheHeaders } from "@/lib/api-utils";
import { formatDateForStorage, getStartOfToday } from "@/lib/date-picker-utils";
import { VoteType } from "@prisma/client";
import { createShootingRangeLookup, getEventLocationDisplay, getRangeNameFromLocation } from "@/lib/event-location";
import { buildVisibilityFilter } from "@/lib/event-list-utils";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";

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

function formatEvents(
  events: Array<{ date: Date } & Record<string, unknown>>,
  rangeLookup: Map<string, { name: string; street: string | null; postalCode: string | null; city: string | null }>
) {
  return events.map(event => ({
    ...event,
    date: formatDateForStorage(event.date),
    locationDisplay: typeof event.location === "string"
      ? getEventLocationDisplay(event.location, rangeLookup)
      : event.location,
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
  const limit = parsePageSize(searchParams.get("limit"), 20, 50);
  const skip = (page - 1) * limit;
  const pastSkip = (pastPage - 1) * limit;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const isAuthenticated = !!userId;
  const canSeeAll = canAccessAdminArea(session?.user);
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

  const rangeNames = [...eventsWithVoteCounts, ...pastEventsWithVoteCounts]
    .map((event) => {
      const location = (event as Record<string, unknown>).location;
      return typeof location === "string" ? getRangeNameFromLocation(location) : "";
    })
    .filter((name) => name.length > 0);

  const uniqueRangeNames = [...new Set(rangeNames)];
  const ranges = uniqueRangeNames.length > 0
    ? await prisma.shootingRange.findMany({
        where: { name: { in: uniqueRangeNames } },
        select: {
          name: true,
          street: true,
          postalCode: true,
          city: true,
        },
      })
    : [];
  const rangeLookup = createShootingRangeLookup(ranges);

  return NextResponse.json({
    events: formatEvents(eventsWithVoteCounts as Array<{ date: Date } & Record<string, unknown>>, rangeLookup),
    pastEvents: formatEvents(pastEventsWithVoteCounts as Array<{ date: Date } & Record<string, unknown>>, rangeLookup),
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
  }, { headers: isAuthenticated ? getAuthNoCacheHeaders() : getPublicCacheHeaders() });
}, { route: "/api/events", method: "GET" });

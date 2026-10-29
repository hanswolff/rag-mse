import { VoteType } from "@prisma/client";
import type { Session } from "next-auth";
import { formatOccupancy, formatRegistrationCount } from "@/lib/registration-count";
import { getStartOfToday } from "@/lib/date-picker-utils";
import { createShootingRangeLookup, getRangeNameFromLocation } from "@/lib/event-location";
import { prisma } from "@/lib/prisma";
import { canAccessAdminArea } from "@/lib/role-utils";
import { buildVisibilityFilter } from "@/lib/event-visibility";

export type VoteCounts = {
  JA: number;
  NEIN: number;
  VIELLEICHT: number;
};

type EventVotesLike = {
  votes?: { vote: VoteType }[];
  guestRegistrations?: { vote: VoteType }[];
  capacity?: number | null;
};

export const EVENT_LIST_PAGE_SIZE = 20;

export function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export function countVotes(
  votes: { vote: VoteType }[] | undefined,
  guestRegistrations: { vote: VoteType }[] | undefined
): VoteCounts {
  const counts: VoteCounts = { JA: 0, NEIN: 0, VIELLEICHT: 0 };
  for (const { vote } of votes ?? []) {
    counts[vote] += 1;
  }
  for (const { vote } of guestRegistrations ?? []) {
    counts[vote] += 1;
  }
  return counts;
}

export function getVoteLabel(event: EventVotesLike): string {
  const counts = countVotes(event.votes, event.guestRegistrations);
  if (typeof event.capacity === "number") {
    return formatOccupancy(counts, event.capacity);
  }
  return formatRegistrationCount(counts);
}

export async function loadEventListPage({
  direction,
  page,
  session,
}: {
  direction: "upcoming" | "past";
  page: string | undefined;
  session: Session | null;
}) {
  const currentPage = parsePageParam(page);
  const skip = (currentPage - 1) * EVENT_LIST_PAGE_SIZE;

  const visibilityFilter = buildVisibilityFilter(
    session?.user?.id,
    canAccessAdminArea(session?.user)
  );
  const currentStart = getStartOfToday();
  const where = {
    ...visibilityFilter,
    date: direction === "upcoming" ? { gte: currentStart } : { lt: currentStart },
  };
  const sortOrder = direction === "upcoming" ? ("asc" as const) : ("desc" as const);

  const select = session?.user
    ? {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
        title: true,
        description: true,
        type: true,
        visibility: true,
        capacity: true,
        votes: { select: { vote: true } },
        guestRegistrations: { select: { vote: true } },
      }
    : {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
        title: true,
        description: true,
        type: true,
        visibility: true,
      };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ date: sortOrder }, { timeFrom: sortOrder }],
      select,
      skip,
      take: EVENT_LIST_PAGE_SIZE,
    }),
    prisma.event.count({ where }),
  ]);

  const rangeNames = events
    .map((event) => getRangeNameFromLocation(event.location))
    .filter((name) => name.length > 0);
  const uniqueRangeNames = [...new Set(rangeNames)];

  const ranges = uniqueRangeNames.length
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

  return {
    events,
    currentPage,
    totalPages: Math.max(1, Math.ceil(total / EVENT_LIST_PAGE_SIZE)),
    rangeLookup: createShootingRangeLookup(ranges),
  };
}

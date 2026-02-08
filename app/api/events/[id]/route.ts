import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { VoteType } from "@prisma/client";
import { isAdmin } from "@/lib/role-utils";
import { withApiErrorHandling, getNoCacheHeaders, getAuthNoCacheHeaders } from "@/lib/api-utils";
import { formatDateForStorage } from "@/lib/date-picker-utils";
import { logResourceNotFound } from "@/lib/logger";

type EventWithVotes = {
  id: string;
  date: Date;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  type: string | null;
  visible: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  votes: {
    id: string;
    vote: VoteType;
    user: {
      id: string;
      name: string;
    };
  }[];
};

type CurrentUserVote = {
  id: string;
  vote: VoteType;
};

type VoteCounts = Record<VoteType, number>;

export const GET = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/events/[id]'>
) => {
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user?.id;
  const canSeeAll = isAdmin(session?.user);
  const userId = session?.user?.id;

  const event = await prisma.event.findUnique({
    where: { id },
    select: isAuthenticated ? {
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
      createdById: true,
      createdAt: true,
      updatedAt: true,
      votes: {
        select: {
          id: true,
          vote: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    } : {
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
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!event) {
    logResourceNotFound('event', id, '/api/events/[id]', 'GET', {
      isAuthenticated,
      userId,
    });
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404, headers: getNoCacheHeaders() }
    );
  }

  if (!event.visible && !canSeeAll && event.createdById !== userId) {
    logResourceNotFound('event', id, '/api/events/[id]', 'GET', {
      reason: 'event not visible',
      isAuthenticated,
      userId,
    });
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404, headers: getNoCacheHeaders() }
    );
  }

  const formattedEvent = {
    ...event,
    date: formatDateForStorage(event.date),
  };

  if (!isAuthenticated) {
    if (!event.visible) {
      return NextResponse.json(
        { error: "Termin nicht gefunden" },
        { status: 404, headers: getNoCacheHeaders() }
      );
    }
    const { createdById, ...publicEvent } = formattedEvent;
    void createdById;
    return NextResponse.json(publicEvent, { headers: getAuthNoCacheHeaders() });
  }

  if ("votes" in formattedEvent) {
    const eventWithVotes = formattedEvent as unknown as EventWithVotes;
    const voteCounts: VoteCounts = eventWithVotes.votes.reduce(
      (acc, { vote }) => ({ ...acc, [vote]: acc[vote] + 1 }),
      { JA: 0, NEIN: 0, VIELLEICHT: 0 }
    );

    if (canSeeAll) {
      return NextResponse.json({ ...formattedEvent, voteCounts }, { headers: getAuthNoCacheHeaders() });
    }

    const currentUserVote = eventWithVotes.votes.find((vote) => vote.user.id === userId);
    const { votes, ...eventWithoutVotes } = formattedEvent;
    void votes;
    return NextResponse.json(
      {
        ...eventWithoutVotes,
        voteCounts,
        currentUserVote: currentUserVote
          ? ({ id: currentUserVote.id, vote: currentUserVote.vote } satisfies CurrentUserVote)
          : null,
      },
      { headers: getAuthNoCacheHeaders() }
    );
  }

  return NextResponse.json(formattedEvent, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/events/[id]", method: "GET" });

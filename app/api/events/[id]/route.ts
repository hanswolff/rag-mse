import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { VoteType } from "@prisma/client";
import type { Visibility } from "@/lib/visibility";
import { getEventAccess } from "@/lib/event-visibility";
import { canAccessAdminArea } from "@/lib/role-utils";
import { withApiErrorHandling, getNoCacheHeaders, getAuthNoCacheHeaders, getPublicCacheHeaders } from "@/lib/api-error-handler";
import { formatDateForStorage } from "@/lib/date-picker-utils";
import { logResourceNotFound } from "@/lib/logger";
import { createShootingRangeLookup, getEventLocationDisplay, getRangeNameFromLocation } from "@/lib/event-location";
import { countVotes } from "@/lib/event-list-utils";

type EventWithVotes = {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  title: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  type: string | null;
  cost: string | null;
  capacity: number | null;
  visibility: Visibility;
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
  guestRegistrations: {
    id: string;
    name: string;
    vote: VoteType;
  }[];
};

type CurrentUserVote = {
  id: string;
  vote: VoteType;
};

export const GET = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/events/[id]'>
) => {
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user?.id;
  const canSeeAll = canAccessAdminArea(session?.user);
  const userId = session?.user?.id;

  const event = await prisma.event.findUnique({
    where: { id },
    select: isAuthenticated ? {
      id: true,
      date: true,
      timeFrom: true,
      timeTo: true,
      location: true,
      title: true,
      description: true,
      latitude: true,
      longitude: true,
      type: true,
      cost: true,
      capacity: true,
      visibility: true,
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
      guestRegistrations: {
        select: {
          id: true,
          name: true,
          vote: true,
        },
      },
    } : {
      id: true,
      date: true,
      timeFrom: true,
      timeTo: true,
      location: true,
      title: true,
      description: true,
      latitude: true,
      longitude: true,
      type: true,
      cost: true,
      capacity: true,
      visibility: true,
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

  const access = getEventAccess(event, { userId, canSeeAll });
  if (access === "login-required") {
    return NextResponse.json(
      { error: "Anmeldung erforderlich" },
      { status: 401, headers: getNoCacheHeaders() }
    );
  }

  if (access === "not-found") {
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
  const rangeName = getRangeNameFromLocation(event.location);
  const range = await prisma.shootingRange.findUnique({
    where: { name: rangeName },
    select: {
      name: true,
      street: true,
      postalCode: true,
      city: true,
    },
  });
  const rangeLookup = createShootingRangeLookup(range ? [range] : []);
  const formattedEventWithLocation = {
    ...formattedEvent,
    locationDisplay: getEventLocationDisplay(formattedEvent.location, rangeLookup),
  };

  if (!isAuthenticated) {
    const { createdById, ...publicEvent } = formattedEventWithLocation;
    void createdById;
    return NextResponse.json(publicEvent, { headers: getPublicCacheHeaders() });
  }

  if ("votes" in formattedEventWithLocation) {
    const eventWithVotes = formattedEventWithLocation as unknown as EventWithVotes;
    const guestRegistrations = eventWithVotes.guestRegistrations ?? [];
    const voteCounts = countVotes(eventWithVotes.votes, guestRegistrations);

    if (canSeeAll) {
      const guestVotes = guestRegistrations.map((guest) => ({
        id: `guest-${guest.id}`,
        vote: guest.vote,
        user: {
          id: `guest-${guest.id}`,
          name: `${guest.name} (Gast)`,
        },
      }));
      const { guestRegistrations: hiddenGuestRegistrations, ...eventWithoutGuests } = eventWithVotes;
      void hiddenGuestRegistrations;
      return NextResponse.json(
        { ...eventWithoutGuests, votes: [...eventWithVotes.votes, ...guestVotes], voteCounts },
        { headers: getAuthNoCacheHeaders() }
      );
    }

    const currentUserVote = eventWithVotes.votes.find((vote) => vote.user.id === userId);
    const { votes, guestRegistrations: hiddenGuestRegistrations, ...eventWithoutVotes } = eventWithVotes;
    void votes;
    void hiddenGuestRegistrations;
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

  return NextResponse.json(formattedEventWithLocation, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/events/[id]", method: "GET" });

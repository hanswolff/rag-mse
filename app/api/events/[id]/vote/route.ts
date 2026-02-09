import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { VoteType } from "@prisma/client";
import { validateVote } from "@/lib/event-validation";
import { isAdmin as checkIsAdmin } from "@/lib/role-utils";
import { parseJsonBody, withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { isEventInPast } from "@/lib/date-utils";

type VoteRequest = { vote?: string };

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/events/[id]/vote'>
) => {
  validateCsrfHeaders(request);

  const user = await requireAuth();
  const { id: eventId } = await ctx.params;
  const body = await parseJsonBody<VoteRequest>(request);

  const { vote } = body;

  if (!vote || !validateVote(vote)) {
    logValidationFailure('/api/events/[id]/vote', 'POST', 'Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT', {
      userId: user.id,
      eventId,
      vote,
    });
    return NextResponse.json(
      { error: "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT" },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      date: true,
      visible: true,
      createdById: true,
    },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  if (isEventInPast(event.date)) {
    logValidationFailure('/api/events/[id]/vote', 'POST', 'Teilnahmeanmeldung für vergangene Termine nicht möglich', {
      userId: user.id,
      eventId,
      eventDate: event.date,
    });
    return NextResponse.json(
      { error: "Teilnahmeanmeldung für vergangene Termine nicht möglich" },
      { status: 400 }
    );
  }

  const canSeeAll = checkIsAdmin(user);
  if (!event.visible && !canSeeAll && event.createdById !== user.id) {
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  const existingVote = await prisma.vote.findUnique({
    where: {
      userId_eventId: {
        userId: user.id,
        eventId,
      },
    },
  });

  if (existingVote) {
    const updatedVote = await prisma.vote.update({
      where: { id: existingVote.id },
      data: { vote: vote as VoteType },
    });

    logInfo('vote_updated', 'Vote updated', {
      userId: user.id,
      userEmail: user.email,
      eventId,
      vote,
    });

    return NextResponse.json(updatedVote);
  }

  const newVote = await prisma.vote.create({
    data: {
      userId: user.id,
      eventId,
      vote: vote as VoteType,
    },
  });

  logInfo('vote_created', 'Vote created', {
    userId: user.id,
    userEmail: user.email,
    eventId,
    vote,
  });

  return NextResponse.json(newVote, { status: 201 });
}, { route: "/api/events/[id]/vote", method: "POST" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/events/[id]/vote'>
) => {
  validateCsrfHeaders(request);

  const user = await requireAuth();
  const { id: eventId } = await ctx.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      date: true,
      visible: true,
      createdById: true,
    },
  });

  if (!event) {
    logResourceNotFound('event', eventId, '/api/events/[id]/vote', 'DELETE', {
      userId: user.id,
      userEmail: user.email,
    });
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  if (isEventInPast(event.date)) {
    logValidationFailure('/api/events/[id]/vote', 'DELETE', 'Teilnahmeanmeldung für vergangene Termine nicht änderbar', {
      userId: user.id,
      eventId,
      eventDate: event.date,
    });
    return NextResponse.json(
      { error: "Teilnahmeanmeldung für vergangene Termine nicht änderbar" },
      { status: 400 }
    );
  }

  const canSeeAll = checkIsAdmin(user);
  if (!event.visible && !canSeeAll && event.createdById !== user.id) {
    logResourceNotFound('event', eventId, '/api/events/[id]/vote', 'DELETE', {
      reason: 'event not visible',
      userId: user.id,
      userEmail: user.email,
    });
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  const vote = await prisma.vote.findUnique({
    where: {
      userId_eventId: {
        userId: user.id,
        eventId,
      },
    },
  });

  if (!vote) {
    logResourceNotFound('vote', `${user.id}-${eventId}`, '/api/events/[id]/vote', 'DELETE', {
      userId: user.id,
      eventId,
    });
    return NextResponse.json(
      { error: "Teilnahmeanmeldung nicht gefunden" },
      { status: 404 }
    );
  }

  await prisma.vote.delete({
    where: { id: vote.id },
  });

  logInfo('vote_deleted', 'Vote deleted', {
    userId: user.id,
    userEmail: user.email,
    eventId,
  });

  return NextResponse.json({ success: true });
}, { route: "/api/events/[id]/vote", method: "DELETE" });

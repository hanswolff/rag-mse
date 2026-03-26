import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { VoteType } from "@prisma/client";
import { validateVote } from "@/lib/event-validation";
import { canAccessAdminArea } from "@/lib/role-utils";
import { parseJsonBody, validateRequestBody, withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { isEventInPast } from "@/lib/date-utils";

type VoteRequest = { vote?: string };
const voteSchema = {
  vote: { type: "string" as const, optional: true },
} as const;

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/events/[id]/vote'>
) => {
  validateCsrfHeaders(request);

  const user = await requireMember();
  const { id: eventId } = await ctx.params;
  const body = await parseJsonBody<VoteRequest>(request);
  const bodyValidation = validateRequestBody(
    body,
    voteSchema,
    { route: "/api/events/[id]/vote", method: "POST" }
  );
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

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
      { status: 409 }
    );
  }

  const canSeeAll = canAccessAdminArea(user);
  if (!event.visible && !canSeeAll && event.createdById !== user.id) {
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  const savedVote = await prisma.vote.upsert({
    where: {
      userId_eventId: {
        userId: user.id,
        eventId,
      },
    },
    create: {
      userId: user.id,
      eventId,
      vote: vote as VoteType,
    },
    update: {
      vote: vote as VoteType,
    },
  });

  logInfo('vote_saved', 'Vote saved', {
    userId: user.id,
    eventId,
    vote,
  });

  return NextResponse.json(savedVote);
}, { route: "/api/events/[id]/vote", method: "POST" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/events/[id]/vote'>
) => {
  validateCsrfHeaders(request);

  const user = await requireMember();
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
      { status: 409 }
    );
  }

  const canSeeAll = canAccessAdminArea(user);
  if (!event.visible && !canSeeAll && event.createdById !== user.id) {
    logResourceNotFound('event', eventId, '/api/events/[id]/vote', 'DELETE', {
      reason: 'event not visible',
      userId: user.id,
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
    eventId,
  });

  return NextResponse.json({ success: true });
}, { route: "/api/events/[id]/vote", method: "DELETE" });

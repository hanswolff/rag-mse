import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { VoteType } from "@prisma/client";
import { validateVote } from "@/lib/event-validation";
import { canAccessAdminArea } from "@/lib/role-utils";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { suppressCatchUpReminder } from "@/lib/reminders/event-reminder-worker";
import { getEventAccess } from "@/lib/event-visibility";
import { isEventInPast } from "@/lib/date-utils";

const ROUTE = "/api/events/[id]/vote";

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
  const body = await parseAndValidateBody<VoteRequest>(request, voteSchema, { route: ROUTE, method: "POST" });

  const { vote } = body;

  if (!vote || !validateVote(vote)) {
    logValidationFailure(ROUTE, 'POST', 'Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT', {
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
      visibility: true,
      createdById: true,
    },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  const canSeeAll = canAccessAdminArea(user);
  if (getEventAccess(event, { userId: user.id, canSeeAll }) !== "granted") {
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  if (isEventInPast(event.date)) {
    logValidationFailure(ROUTE, 'POST', 'Teilnahmeanmeldung für vergangene Termine nicht möglich', {
      userId: user.id,
      eventId,
      eventDate: event.date,
    });
    return NextResponse.json(
      { error: "Teilnahmeanmeldung für vergangene Termine nicht möglich" },
      { status: 409 }
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
}, { route: ROUTE, method: "POST" });

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
      visibility: true,
      createdById: true,
    },
  });

  if (!event) {
    logResourceNotFound('event', eventId, ROUTE, 'DELETE', {
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  const canSeeAll = canAccessAdminArea(user);
  if (getEventAccess(event, { userId: user.id, canSeeAll }) !== "granted") {
    logResourceNotFound('event', eventId, ROUTE, 'DELETE', {
      reason: 'event not visible',
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Termin nicht gefunden" },
      { status: 404 }
    );
  }

  if (isEventInPast(event.date)) {
    logValidationFailure(ROUTE, 'DELETE', 'Teilnahmeanmeldung für vergangene Termine nicht änderbar', {
      userId: user.id,
      eventId,
      eventDate: event.date,
    });
    return NextResponse.json(
      { error: "Teilnahmeanmeldung für vergangene Termine nicht änderbar" },
      { status: 409 }
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
    logResourceNotFound('vote', `${user.id}-${eventId}`, ROUTE, 'DELETE', {
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
  await suppressCatchUpReminder(user.id, eventId);

  logInfo('vote_deleted', 'Vote deleted', {
    userId: user.id,
    eventId,
  });

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

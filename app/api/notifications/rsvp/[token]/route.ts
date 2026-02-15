import { NextRequest, NextResponse } from "next/server";
import { VoteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";
import { getClientIp, getNoCacheHeaders, handleRateLimitBlocked, parseJsonBody, withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { hashNotificationToken } from "@/lib/notifications";
import { formatDateForStorage } from "@/lib/date-picker-utils";
import { validateVote } from "@/lib/event-validation";
import { isEventInPast } from "@/lib/date-utils";
import { logResourceNotFound, logValidationFailure, maskToken } from "@/lib/logger";

type VoteRequest = { vote?: string };

async function findValidDispatch(token: string) {
  const tokenHash = hashNotificationToken(token);
  const dispatch = await prisma.eventReminderDispatch.findUnique({
    where: { rsvpTokenHash: tokenHash },
    include: {
      event: {
        select: {
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
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!dispatch) {
    return { dispatch: null, tokenHash, status: 404 };
  }

  if (dispatch.rsvpTokenExpiresAt < new Date()) {
    return { dispatch: null, tokenHash, status: 410 };
  }

  return { dispatch, tokenHash, status: 200 };
}

export const GET = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/notifications/rsvp/[token]">
) => {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const tokenHash = hashNotificationToken(token);
  const rateLimitResult = await checkTokenRateLimit(clientIp, tokenHash);

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      "notification_rsvp_get_rate_limited",
      "/api/notifications/rsvp/[token]",
      tokenHash,
      clientIp,
      rateLimitResult.blockedUntil,
      rateLimitResult.attemptCount
    );
  }

  const { dispatch, status } = await findValidDispatch(token);
  if (!dispatch || !dispatch.event.visible) {
    logResourceNotFound("event_reminder_dispatch", maskToken(token), "/api/notifications/rsvp/[token]", "GET");
    const responseStatus = dispatch && !dispatch.event.visible ? 404 : status;
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status: responseStatus, headers: getNoCacheHeaders() }
    );
  }

  const currentVote = await prisma.vote.findUnique({
    where: {
      userId_eventId: {
        userId: dispatch.user.id,
        eventId: dispatch.event.id,
      },
    },
    select: {
      id: true,
      vote: true,
    },
  });

  await recordSuccessfulTokenUsage(tokenHash, clientIp);

  return NextResponse.json(
    {
      event: {
        ...dispatch.event,
        date: formatDateForStorage(dispatch.event.date),
      },
      user: {
        name: dispatch.user.name,
      },
      currentVote,
    },
    { headers: getNoCacheHeaders() }
  );
}, { route: "/api/notifications/rsvp/[token]", method: "GET" });

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/notifications/rsvp/[token]">
) => {
  validateCsrfHeaders(request);

  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const tokenHash = hashNotificationToken(token);
  const rateLimitResult = await checkTokenRateLimit(clientIp, tokenHash);

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      "notification_rsvp_post_rate_limited",
      "/api/notifications/rsvp/[token]",
      tokenHash,
      clientIp,
      rateLimitResult.blockedUntil,
      rateLimitResult.attemptCount
    );
  }

  const body = await parseJsonBody<VoteRequest>(request);
  const { vote } = body;

  if (!vote || !validateVote(vote)) {
    logValidationFailure(
      "/api/notifications/rsvp/[token]",
      "POST",
      "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT"
    );
    return NextResponse.json(
      { error: "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT" },
      { status: 400 }
    );
  }

  const { dispatch, status } = await findValidDispatch(token);
  if (!dispatch || !dispatch.event.visible) {
    const responseStatus = dispatch && !dispatch.event.visible ? 404 : status;
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status: responseStatus, headers: getNoCacheHeaders() }
    );
  }

  if (isEventInPast(dispatch.event.date)) {
    return NextResponse.json(
      { error: "Teilnahmeanmeldung für vergangene Termine nicht möglich" },
      { status: 400, headers: getNoCacheHeaders() }
    );
  }

  const savedVote = await prisma.vote.upsert({
    where: {
      userId_eventId: {
        userId: dispatch.user.id,
        eventId: dispatch.event.id,
      },
    },
    create: {
      userId: dispatch.user.id,
      eventId: dispatch.event.id,
      vote: vote as VoteType,
    },
    update: {
      vote: vote as VoteType,
    },
    select: {
      id: true,
      vote: true,
      eventId: true,
      userId: true,
    },
  });

  await recordSuccessfulTokenUsage(tokenHash, clientIp);

  return NextResponse.json(savedVote, { headers: getNoCacheHeaders() });
}, { route: "/api/notifications/rsvp/[token]", method: "POST" });

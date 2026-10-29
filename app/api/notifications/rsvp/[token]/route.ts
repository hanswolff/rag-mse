import { NextRequest, NextResponse } from "next/server";
import { VoteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNoCacheHeaders } from "@/lib/api-error-handler";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { recordSuccessfulTokenUsageWithPolicy, withTokenRateLimit } from "@/lib/api-utils";
import { hashNotificationToken } from "@/lib/reminders/notifications";
import { formatDateForStorage } from "@/lib/date-picker-utils";
import { validateVote } from "@/lib/event-validation";
import { isEventInPast } from "@/lib/date-utils";
import { logResourceNotFound, logValidationFailure, maskToken } from "@/lib/logger";
import { Permissions } from "@/lib/permissions";
import { canView } from "@/lib/visibility";

const ROUTE = "/api/notifications/rsvp/[token]";

type VoteRequest = { vote?: string };
const voteSchema = {
  vote: { type: "string" as const, optional: true },
} as const;

async function findValidDispatch(token: string) {
  const tokenHash = hashNotificationToken(token);
  const dispatch = await prisma.eventReminderDispatch.findUnique({
    where: { rsvpTokenHash: tokenHash },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          timeFrom: true,
          timeTo: true,
          location: true,
          description: true,
          latitude: true,
          longitude: true,
          type: true,
          visibility: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
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

  if (!canView(dispatch.event.visibility, true)) {
    return { dispatch: null, tokenHash, status: 404 };
  }

  return { dispatch, tokenHash, status: 200 };
}

export const GET = withTokenRateLimit({
  route: ROUTE,
  method: "GET",
  action: "notification_rsvp_get_rate_limited",
  hashToken: hashNotificationToken,
  invalidTokenMessage: "Ungültiger Link",
}, async (_request: NextRequest, { token, tokenHash, clientIp }) => {
  const { dispatch, status } = await findValidDispatch(token);
  if (!dispatch) {
    logResourceNotFound("event_reminder_dispatch", maskToken(token), ROUTE, "GET");
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status, headers: getNoCacheHeaders() }
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

  await recordSuccessfulTokenUsageWithPolicy(
    ROUTE,
    "GET",
    tokenHash,
    clientIp,
    maskToken(token)
  );

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
});

export const POST = withTokenRateLimit({
  route: ROUTE,
  method: "POST",
  action: "notification_rsvp_post_rate_limited",
  hashToken: hashNotificationToken,
  requireCsrf: true,
  invalidTokenMessage: "Ungültiger Link",
}, async (request: NextRequest, { token, tokenHash, clientIp }) => {
  const body = await parseAndValidateBody<VoteRequest>(request, voteSchema, { route: ROUTE, method: "POST" });
  const { vote } = body;

  if (!vote || !validateVote(vote)) {
    logValidationFailure(
      ROUTE,
      "POST",
      "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT"
    );
    return NextResponse.json(
      { error: "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT" },
      { status: 400 }
    );
  }

  const { dispatch, status } = await findValidDispatch(token);
  if (!dispatch) {
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status, headers: getNoCacheHeaders() }
    );
  }

  if (!Permissions.canVoteAttendance(dispatch.user.role)) {
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status: 403, headers: getNoCacheHeaders() }
    );
  }

  if (isEventInPast(dispatch.event.date)) {
    return NextResponse.json(
      { error: "Teilnahmeanmeldung für vergangene Termine nicht möglich" },
      { status: 409, headers: getNoCacheHeaders() }
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

  await recordSuccessfulTokenUsageWithPolicy(
    ROUTE,
    "POST",
    tokenHash,
    clientIp,
    maskToken(token)
  );

  return NextResponse.json(savedVote, { headers: getNoCacheHeaders() });
});

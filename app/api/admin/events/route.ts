import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { normalizeCoordinate, validateCreateEventRequest, type CreateEventRequest } from "@/lib/event-validation";
import { parseJsonBody, ValidationError, MAX_REQUEST_BODY_SIZE } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logValidationFailure, maskEmail, logError } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";
import { triggerImmediateEventReminders } from "@/lib/reminders/event-reminder-worker";
import { canView, parseVisibility } from "@/lib/visibility";
import { formatDateForStorage, parseDateAndTime } from "@/lib/date-picker-utils";
import { hasEventDescriptionContent, sanitizeEventDescriptionHtml } from "@/lib/event-description";
import { normalizeCapacity, normalizeOptionalText } from "@/lib/event-fields";
import { VoteType } from "@prisma/client";
import { countVotes } from "@/lib/event-list-utils";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";

const ROUTE = "/api/admin/events";

const EVENT_REQUEST_BODY_SIZE = MAX_REQUEST_BODY_SIZE + 128 * 1024;

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin("read");

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"), 10);
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: { votes: true },
        },
        votes: {
          select: { vote: true },
        },
        guestRegistrations: {
          select: { vote: true },
        },
      },
    }),
    prisma.event.count(),
  ]);

  const formattedEvents = events.map(({ votes, guestRegistrations, ...event }: (typeof events)[number] & { votes: { vote: VoteType }[]; guestRegistrations?: { vote: VoteType }[] }) => ({
    ...event,
    date: formatDateForStorage(event.date),
    voteCounts: countVotes(votes, guestRegistrations),
  }));

  return NextResponse.json({
    events: formattedEvents,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireAdmin("write");
  const body = await parseJsonBody<CreateEventRequest>(request, EVENT_REQUEST_BODY_SIZE);

  const validation = validateCreateEventRequest(body);

  if (!validation.isValid) {
    logValidationFailure(ROUTE, 'POST', validation.errors);
    throw new ValidationError(validation.errors, { fieldErrors: validation.fieldErrors });
  }

  const { date, timeFrom, timeTo, location, description, latitude, longitude, type, title, cost, capacity, visibility } = body;
  const sanitizedDescription = sanitizeEventDescriptionHtml(description);

  if (!hasEventDescriptionContent(sanitizedDescription)) {
    logValidationFailure(ROUTE, 'POST', ["Beschreibung darf nicht leer sein"]);
    throw new ValidationError(["Beschreibung darf nicht leer sein"], { fieldErrors: [{ field: "description", message: "Beschreibung darf nicht leer sein" }] });
  }

  const eventDate = parseDateAndTime(date, timeFrom);

  const parsedLatitude = normalizeCoordinate(latitude, "create");
  const parsedLongitude = normalizeCoordinate(longitude, "create");

  const newEvent = await prisma.event.create({
    data: {
      date: eventDate,
      timeFrom,
      timeTo,
      location,
      title: normalizeOptionalText(title),
      description: sanitizedDescription,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      type: type || null,
      cost: normalizeOptionalText(cost),
      capacity: normalizeCapacity(capacity),
      visibility: parseVisibility(visibility),
      createdById: user.id,
    },
  });

  logInfo('event_created', 'Event created', {
    eventId: newEvent.id,
    title: sanitizedDescription,
    date: eventDate,
    createdBy: maskEmail(user.email),
  });

  logAdminAction("event_create", user, {
    eventId: newEvent.id,
    date: eventDate.toISOString(),
    location,
  });

  if (canView(newEvent.visibility, true)) {
    void triggerImmediateEventReminders(newEvent.id).catch((err: unknown) =>
      logError("event_created_reminder_failed", "Failed to trigger immediate reminders", {
        eventId: newEvent.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }

  return NextResponse.json({
    ...newEvent,
    date: formatDateForStorage(newEvent.date),
  }, { status: 201 });
}, { route: ROUTE, method: "POST" });

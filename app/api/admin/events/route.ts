import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateCreateEventRequest, type CreateEventRequest } from "@/lib/event-validation";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateCsrfHeaders,
  MAX_REQUEST_BODY_SIZE,
} from "@/lib/api-utils";
import { logInfo, logValidationFailure, maskEmail, logError } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";
import { triggerImmediateEventReminders } from "@/lib/event-reminder-worker";
import { formatDateForStorage, parseDateAndTime } from "@/lib/date-picker-utils";
import { hasEventDescriptionContent, sanitizeEventDescriptionHtml } from "@/lib/event-description";
import { normalizeCapacity, normalizeOptionalText } from "@/lib/event-fields";
import { VoteType } from "@prisma/client";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";

const EVENT_REQUEST_BODY_SIZE = MAX_REQUEST_BODY_SIZE + 128 * 1024;

function normalizeCoordinate(value?: string | number | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return parseFloat(trimmed);
}

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

  const formattedEvents = events.map(({ votes, guestRegistrations, ...event }: (typeof events)[number] & { votes: { vote: VoteType }[]; guestRegistrations?: { vote: VoteType }[] }) => {
    const voteCounts = votes.reduce(
      (acc, { vote }) => ({ ...acc, [vote]: acc[vote] + 1 }),
      { JA: 0, NEIN: 0, VIELLEICHT: 0 }
    );

    for (const guest of guestRegistrations ?? []) {
      voteCounts[guest.vote] += 1;
    }

    return {
      ...event,
      date: formatDateForStorage(event.date),
      voteCounts,
    };
  });

  return NextResponse.json({
    events: formattedEvents,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}, { route: "/api/admin/events", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireAdmin("write");
  const body = await parseJsonBody<CreateEventRequest>(request, EVENT_REQUEST_BODY_SIZE);

  const validation = validateCreateEventRequest(body);

  if (!validation.isValid) {
    logValidationFailure('/api/admin/events', 'POST', validation.errors);
    return NextResponse.json({ error: validation.errors.join(". "), fieldErrors: validation.fieldErrors }, { status: 400 });
  }

  const { date, timeFrom, timeTo, location, description, latitude, longitude, type, title, cost, capacity, visible } = body;
  const sanitizedDescription = sanitizeEventDescriptionHtml(description);

  if (!hasEventDescriptionContent(sanitizedDescription)) {
    logValidationFailure('/api/admin/events', 'POST', ["Beschreibung darf nicht leer sein"]);
    return NextResponse.json({ error: "Beschreibung darf nicht leer sein", fieldErrors: [{ field: "description", message: "Beschreibung darf nicht leer sein" }] }, { status: 400 });
  }

  const eventDate = parseDateAndTime(date, timeFrom);

  const parsedLatitude = normalizeCoordinate(latitude ?? null);
  const parsedLongitude = normalizeCoordinate(longitude ?? null);

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
      visible: visible ?? true,
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

  if (newEvent.visible) {
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
}, { route: "/api/admin/events", method: "POST" });

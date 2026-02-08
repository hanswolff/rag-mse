import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateCreateEventRequest, type CreateEventRequest } from "@/lib/event-validation";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateRequestBody,
  validateCsrfHeaders,
  MAX_REQUEST_BODY_SIZE,
} from "@/lib/api-utils";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { formatDateForStorage, parseDateAndTime } from "@/lib/date-picker-utils";
import { hasEventDescriptionContent, sanitizeEventDescriptionHtml } from "@/lib/event-description";

const createEventSchema = {
  date: { type: 'string' as const },
  timeFrom: { type: 'string' as const },
  timeTo: { type: 'string' as const },
  location: { type: 'string' as const },
  description: { type: 'string' as const },
  latitude: { type: 'string' as const, optional: true },
  longitude: { type: 'string' as const, optional: true },
  type: { type: 'string' as const, optional: true },
  visible: { type: 'boolean' as const, optional: true },
} as const;

const MAX_PAGE_SIZE = 100;
const EVENT_REQUEST_BODY_SIZE = MAX_REQUEST_BODY_SIZE + 128 * 1024;

function parsePageSize(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parsePageNumber(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function normalizeCoordinate(value?: string | number | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return parseFloat(trimmed);
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin();

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
      },
    }),
    prisma.event.count(),
  ]);

  const formattedEvents = events.map((event: (typeof events)[number]) => ({
    ...event,
    date: formatDateForStorage(event.date),
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
}, { route: "/api/admin/events", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireAdmin();
  const body = await parseJsonBody<CreateEventRequest>(request, EVENT_REQUEST_BODY_SIZE);

  const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, createEventSchema, { route: '/api/admin/events', method: 'POST' });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const validation = validateCreateEventRequest(body);

  if (!validation.isValid) {
    logValidationFailure('/api/admin/events', 'POST', validation.errors);
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const { date, timeFrom, timeTo, location, description, latitude, longitude, type, visible } = body;
  const sanitizedDescription = sanitizeEventDescriptionHtml(description);

  if (!hasEventDescriptionContent(sanitizedDescription)) {
    logValidationFailure('/api/admin/events', 'POST', ["Beschreibung darf nicht leer sein"]);
    return NextResponse.json({ error: "Beschreibung darf nicht leer sein" }, { status: 400 });
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
      description: sanitizedDescription,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      type: type || null,
      visible: visible ?? true,
      createdById: user.id,
    },
  });

  logInfo('event_created', 'Event created', {
    eventId: newEvent.id,
    title: sanitizedDescription,
    date: eventDate,
    createdBy: user.email,
  });

  return NextResponse.json(newEvent, { status: 201 });
}, { route: "/api/admin/events", method: "POST" });

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateUpdateEventRequest, validateTimeString, type UpdateEventRequest } from "@/lib/event-validation";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateRequestBody,
  validateCsrfHeaders,
  MAX_REQUEST_BODY_SIZE,
} from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { formatDateForStorage, parseDateAndTime } from "@/lib/date-picker-utils";
import { hasEventDescriptionContent, sanitizeEventDescriptionHtml } from "@/lib/event-description";

const updateEventSchema = {
  date: { type: 'string' as const, optional: true },
  timeFrom: { type: 'string' as const, optional: true },
  timeTo: { type: 'string' as const, optional: true },
  location: { type: 'string' as const, optional: true },
  description: { type: 'string' as const, optional: true },
  latitude: { type: 'string' as const, optional: true },
  longitude: { type: 'string' as const, optional: true },
  type: { type: 'string' as const, optional: true },
  visible: { type: 'boolean' as const, optional: true },
} as const;
const EVENT_REQUEST_BODY_SIZE = MAX_REQUEST_BODY_SIZE + 128 * 1024;

function normalizeCoordinate(value?: string | number | null): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return parseFloat(trimmed);
}

export const GET = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<'/api/admin/events/[id]'>) => {
  await requireAdmin();

  const { id } = await ctx.params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      votes: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    logResourceNotFound('event', id, '/api/admin/events/[id]', 'GET');
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  const formattedEvent = {
    ...event,
    date: formatDateForStorage(event.date),
  };

  return NextResponse.json(formattedEvent);
}, { route: "/api/admin/events/[id]", method: "GET" });

export const PUT = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<'/api/admin/events/[id]'>) => {
  validateCsrfHeaders(request);

  await requireAdmin();

  const { id } = await ctx.params;
  const body = await parseJsonBody<UpdateEventRequest>(request, EVENT_REQUEST_BODY_SIZE);

  const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, updateEventSchema, { route: '/api/admin/events/[id]', method: 'PUT' });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const validation = validateUpdateEventRequest(body);

  if (!validation.isValid) {
    logValidationFailure('/api/admin/events/[id]', 'PUT', validation.errors, { eventId: id });
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const existingEvent = await prisma.event.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    logResourceNotFound('event', id, '/api/admin/events/[id]', 'PUT');
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  const updateData: {
    date?: Date;
    timeFrom?: string;
    timeTo?: string;
    location?: string;
    description?: string;
    latitude?: number | null;
    longitude?: number | null;
    type?: string | null;
    visible?: boolean;
  } = {};

  const nextTimeFrom =
    typeof body.timeFrom === "string" && body.timeFrom !== ""
      ? body.timeFrom
      : existingEvent.timeFrom;
  const nextTimeTo =
    typeof body.timeTo === "string" && body.timeTo !== ""
      ? body.timeTo
      : existingEvent.timeTo;

  if (validateTimeString(nextTimeFrom) && validateTimeString(nextTimeTo)) {
    const [hoursFrom, minutesFrom] = nextTimeFrom.split(":").map(Number);
    const [hoursTo, minutesTo] = nextTimeTo.split(":").map(Number);
    const fromMinutes = hoursFrom * 60 + minutesFrom;
    const toMinutes = hoursTo * 60 + minutesTo;

    if (fromMinutes >= toMinutes) {
      return NextResponse.json({ error: "Uhrzeit bis muss nach Uhrzeit von liegen" }, { status: 400 });
    }
  }

  if (body.date !== undefined || body.timeFrom !== undefined) {
    const datePart =
      typeof body.date === "string" && body.date !== ""
        ? body.date
        : formatDateForStorage(existingEvent.date);
    updateData.date = parseDateAndTime(datePart, nextTimeFrom);
  }

  if (typeof body.timeFrom === "string" && body.timeFrom !== "") {
    updateData.timeFrom = body.timeFrom;
  }

  if (typeof body.timeTo === "string" && body.timeTo !== "") {
    updateData.timeTo = body.timeTo;
  }

  if (body.location !== undefined) {
    updateData.location = String(body.location).trim();
  }

  if (body.description !== undefined) {
    const sanitizedDescription = sanitizeEventDescriptionHtml(String(body.description));

    if (!hasEventDescriptionContent(sanitizedDescription)) {
      return NextResponse.json({ error: "Beschreibung darf nicht leer sein" }, { status: 400 });
    }

    updateData.description = sanitizedDescription;
  }

  const normalizedLatitude = normalizeCoordinate(body.latitude);
  if (normalizedLatitude !== undefined) {
    updateData.latitude = normalizedLatitude;
  }

  const normalizedLongitude = normalizeCoordinate(body.longitude);
  if (normalizedLongitude !== undefined) {
    updateData.longitude = normalizedLongitude;
  }

  if (body.type !== undefined) {
    updateData.type = body.type || null;
  }

  if (body.visible !== undefined) {
    updateData.visible = body.visible;
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: updateData,
  });

  logInfo('event_updated', 'Event updated', {
    eventId: updatedEvent.id,
    title: updatedEvent.description,
    date: updatedEvent.date,
    updatedBy: 'admin',
  });

  return NextResponse.json({
    ...updatedEvent,
    date: formatDateForStorage(updatedEvent.date),
  });
}, { route: "/api/admin/events/[id]", method: "PUT" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<'/api/admin/events/[id]'>) => {
  validateCsrfHeaders(request);

  await requireAdmin();

  const { id } = await ctx.params;

  const existingEvent = await prisma.event.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    logResourceNotFound('event', id, '/api/admin/events/[id]', 'DELETE');
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  await prisma.event.delete({
    where: { id },
  });

  logInfo('event_deleted', 'Event deleted', {
    eventId: existingEvent.id,
    title: existingEvent.description,
    date: existingEvent.date,
    deletedBy: 'admin',
  });

  return NextResponse.json({ success: true });
}, { route: "/api/admin/events/[id]", method: "DELETE" });

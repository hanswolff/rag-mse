import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateUpdateEventRequest, validateTimeString, type UpdateEventRequest } from "@/lib/event-validation";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateCsrfHeaders,
  MAX_REQUEST_BODY_SIZE,
} from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";
import { formatDateForStorage, parseDateAndTime } from "@/lib/date-picker-utils";
import { hasEventDescriptionContent, sanitizeEventDescriptionHtml } from "@/lib/event-description";

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
  await requireAdmin("read");

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
      guestRegistrations: {
        select: {
          id: true,
          name: true,
          vote: true,
          createdAt: true,
          updatedAt: true,
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

  const admin = await requireAdmin("write");

  const { id } = await ctx.params;
  const body = await parseJsonBody<UpdateEventRequest>(request, EVENT_REQUEST_BODY_SIZE);

  const validation = validateUpdateEventRequest(body);

  if (!validation.isValid) {
    logValidationFailure('/api/admin/events/[id]', 'PUT', validation.errors, { eventId: id });
    return NextResponse.json({ error: validation.errors.join(". "), fieldErrors: validation.fieldErrors }, { status: 400 });
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
      return NextResponse.json({ error: "Uhrzeit bis muss nach Uhrzeit von liegen", fieldErrors: [{ field: "timeTo", message: "Uhrzeit bis muss nach Uhrzeit von liegen" }] }, { status: 400 });
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
      return NextResponse.json({ error: "Beschreibung darf nicht leer sein", fieldErrors: [{ field: "description", message: "Beschreibung darf nicht leer sein" }] }, { status: 400 });
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

  logAdminAction("event_update", admin, {
    eventId: updatedEvent.id,
    changedFields: Object.keys(updateData),
  });

  return NextResponse.json({
    ...updatedEvent,
    date: formatDateForStorage(updatedEvent.date),
  });
}, { route: "/api/admin/events/[id]", method: "PUT" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<'/api/admin/events/[id]'>) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin("write");

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

  logAdminAction("event_delete", admin, {
    eventId: existingEvent.id,
    date: existingEvent.date.toISOString(),
  });

  return NextResponse.json({ success: true });
}, { route: "/api/admin/events/[id]", method: "DELETE" });

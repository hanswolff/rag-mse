import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { normalizeCoordinate, validateUpdateEventRequest, validateTimeString, type UpdateEventRequest } from "@/lib/event-validation";
import { parseJsonBody, ValidationError, MAX_REQUEST_BODY_SIZE } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logError, logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { canView, parseVisibility, type Visibility } from "@/lib/visibility";
import { logAdminAction } from "@/lib/audit-log";
import { formatDateForStorage, parseDateAndTime } from "@/lib/date-picker-utils";
import { isTimeRangeValid } from "@/lib/dates";
import { hasEventDescriptionContent, sanitizeEventDescriptionHtml } from "@/lib/event-description";
import { normalizeCapacity, normalizeOptionalText } from "@/lib/event-fields";
import { triggerImmediateEventReminders } from "@/lib/reminders/event-reminder-worker";

const ROUTE = "/api/admin/events/[id]";

const EVENT_REQUEST_BODY_SIZE = MAX_REQUEST_BODY_SIZE + 128 * 1024;

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
    logResourceNotFound('event', id, ROUTE, 'GET');
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  const formattedEvent = {
    ...event,
    date: formatDateForStorage(event.date),
  };

  return NextResponse.json(formattedEvent);
}, { route: ROUTE, method: "GET" });

export const PUT = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<'/api/admin/events/[id]'>) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin("write");

  const { id } = await ctx.params;
  const body = await parseJsonBody<UpdateEventRequest>(request, EVENT_REQUEST_BODY_SIZE);

  const validation = validateUpdateEventRequest(body);

  if (!validation.isValid) {
    logValidationFailure(ROUTE, 'PUT', validation.errors, { eventId: id });
    throw new ValidationError(validation.errors, { fieldErrors: validation.fieldErrors });
  }

  const existingEvent = await prisma.event.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    logResourceNotFound('event', id, ROUTE, 'PUT');
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  const updateData: {
    date?: Date;
    timeFrom?: string;
    timeTo?: string;
    location?: string;
    title?: string | null;
    description?: string;
    latitude?: number | null;
    longitude?: number | null;
    type?: string | null;
    cost?: string | null;
    capacity?: number | null;
    visibility?: Visibility;
  } = {};

  const nextTimeFrom =
    typeof body.timeFrom === "string" && body.timeFrom !== ""
      ? body.timeFrom
      : existingEvent.timeFrom;
  const nextTimeTo =
    typeof body.timeTo === "string" && body.timeTo !== ""
      ? body.timeTo
      : existingEvent.timeTo;

  if (validateTimeString(nextTimeFrom) && validateTimeString(nextTimeTo) && !isTimeRangeValid(nextTimeFrom, nextTimeTo)) {
    throw new ValidationError(["Uhrzeit bis muss nach Uhrzeit von liegen"], { fieldErrors: [{ field: "timeTo", message: "Uhrzeit bis muss nach Uhrzeit von liegen" }] });
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

  if (body.title !== undefined) {
    updateData.title = normalizeOptionalText(body.title);
  }

  if (body.description !== undefined) {
    const sanitizedDescription = sanitizeEventDescriptionHtml(String(body.description));

    if (!hasEventDescriptionContent(sanitizedDescription)) {
      throw new ValidationError(["Beschreibung darf nicht leer sein"], { fieldErrors: [{ field: "description", message: "Beschreibung darf nicht leer sein" }] });
    }

    updateData.description = sanitizedDescription;
  }

  const normalizedLatitude = normalizeCoordinate(body.latitude, "update");
  if (normalizedLatitude !== undefined) {
    updateData.latitude = normalizedLatitude;
  }

  const normalizedLongitude = normalizeCoordinate(body.longitude, "update");
  if (normalizedLongitude !== undefined) {
    updateData.longitude = normalizedLongitude;
  }

  if (body.type !== undefined) {
    updateData.type = body.type || null;
  }

  if (body.cost !== undefined) {
    updateData.cost = normalizeOptionalText(body.cost);
  }

  if (body.capacity !== undefined) {
    updateData.capacity = normalizeCapacity(body.capacity);
  }

  if (body.visibility !== undefined) {
    updateData.visibility = parseVisibility(body.visibility);
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

  const isMemberVisible = canView(updatedEvent.visibility, true);
  const becameVisible = !canView(existingEvent.visibility, true) && isMemberVisible;
  const wasRescheduled =
    updatedEvent.date.getTime() !== existingEvent.date.getTime() ||
    updatedEvent.timeFrom !== existingEvent.timeFrom;

  if (isMemberVisible && (becameVisible || wasRescheduled)) {
    void triggerImmediateEventReminders(updatedEvent.id).catch((err: unknown) =>
      logError("event_updated_reminder_failed", "Failed to trigger immediate reminders", {
        eventId: updatedEvent.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }

  return NextResponse.json({
    ...updatedEvent,
    date: formatDateForStorage(updatedEvent.date),
  });
}, { route: ROUTE, method: "PUT" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<'/api/admin/events/[id]'>) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin("write");

  const { id } = await ctx.params;

  const existingEvent = await prisma.event.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    logResourceNotFound('event', id, ROUTE, 'DELETE');
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
}, { route: ROUTE, method: "DELETE" });

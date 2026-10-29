import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logAdminAction } from "@/lib/audit-log";
import {
  EXTERNAL_EVENT_INCLUDE,
  parseExternalEventRequest,
  serializeExternalEvent,
} from "@/lib/external-event-request";

const ROUTE = "/api/admin/fremdtermine";

export const GET = withApiErrorHandling(async () => {
  await requireAdmin("read");

  const externalEvents = await prisma.externalEvent.findMany({
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }],
    include: EXTERNAL_EVENT_INCLUDE,
  });

  return NextResponse.json({ externalEvents: externalEvents.map(serializeExternalEvent) });
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");

  const data = await parseExternalEventRequest(request, { route: ROUTE, method: "POST" });

  const externalEvent = await prisma.externalEvent.create({
    data: { ...data, createdById: user.id },
    include: EXTERNAL_EVENT_INCLUDE,
  });

  logAdminAction("external_event_create", user, { externalEventId: externalEvent.id });

  return NextResponse.json(serializeExternalEvent(externalEvent), { status: 201 });
}, { route: ROUTE, method: "POST" });

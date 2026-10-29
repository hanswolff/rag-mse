import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logResourceNotFound } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";
import {
  EXTERNAL_EVENT_INCLUDE,
  parseExternalEventRequest,
  serializeExternalEvent,
} from "@/lib/external-event-request";

const ROUTE = "/api/admin/fremdtermine/[id]";

function notFound(id: string, method: string) {
  logResourceNotFound("external_event", id, ROUTE, method);
  return NextResponse.json({ error: "Fremdtermin nicht gefunden" }, { status: 404 });
}

async function exists(id: string): Promise<boolean> {
  return (await prisma.externalEvent.count({ where: { id } })) > 0;
}

export const GET = withApiErrorHandling(async (
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/fremdtermine/[id]">
) => {
  await requireAdmin("read");
  const { id } = await ctx.params;

  const externalEvent = await prisma.externalEvent.findUnique({ where: { id }, include: EXTERNAL_EVENT_INCLUDE });
  if (!externalEvent) {
    return notFound(id, "GET");
  }

  return NextResponse.json(serializeExternalEvent(externalEvent));
}, { route: ROUTE, method: "GET" });

export const PUT = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/fremdtermine/[id]">
) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await ctx.params;

  const data = await parseExternalEventRequest(request, { route: ROUTE, method: "PUT" });

  if (!(await exists(id))) {
    return notFound(id, "PUT");
  }

  const externalEvent = await prisma.externalEvent.update({
    where: { id },
    data,
    include: EXTERNAL_EVENT_INCLUDE,
  });

  logAdminAction("external_event_update", user, { externalEventId: id });

  return NextResponse.json(serializeExternalEvent(externalEvent));
}, { route: ROUTE, method: "PUT" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/fremdtermine/[id]">
) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await ctx.params;

  if (!(await exists(id))) {
    return notFound(id, "DELETE");
  }

  await prisma.externalEvent.delete({ where: { id } });

  logAdminAction("external_event_delete", user, { externalEventId: id });

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

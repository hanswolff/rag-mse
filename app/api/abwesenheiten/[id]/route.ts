import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logResourceNotFound } from "@/lib/logger";
import { parseAbsenceRequest, serializeAbsence } from "@/lib/absence-request";
import { deleteAbsence, updateAbsence } from "@/lib/absence-service";

const ROUTE = "/api/abwesenheiten/[id]";

function notFound(id: string, method: string, userId: string) {
  logResourceNotFound("absence", id, ROUTE, method, { userId });
  return NextResponse.json({ error: "Abwesenheit nicht gefunden" }, { status: 404 });
}

export const PUT = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/abwesenheiten/[id]">
) => {
  validateCsrfHeaders(request);
  const user = await requireMember();
  const { id } = await ctx.params;

  const routeInfo = { route: ROUTE, method: "PUT" };
  const result = await updateAbsence(user, id, await parseAbsenceRequest(request, routeInfo), routeInfo);
  if (!result) {
    return notFound(id, "PUT", user.id);
  }

  const { absence, previousUserId } = result;
  logInfo("absence_updated", "Absence updated", {
    userId: absence.userId,
    actorId: user.id,
    absenceId: id,
    ...(previousUserId !== absence.userId ? { previousUserId } : {}),
  });

  return NextResponse.json(serializeAbsence(absence), { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "PUT" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/abwesenheiten/[id]">
) => {
  validateCsrfHeaders(request);
  const user = await requireMember();
  const { id } = await ctx.params;

  const deleted = await deleteAbsence(user, id);
  if (!deleted) {
    return notFound(id, "DELETE", user.id);
  }

  logInfo("absence_deleted", "Absence deleted", { userId: deleted.userId, actorId: user.id, absenceId: id });

  return NextResponse.json({ success: true }, { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "DELETE" });

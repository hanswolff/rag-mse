import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logResourceNotFound } from "@/lib/logger";
import { parseAbsenceRequest, serializeAbsence } from "@/lib/absence-request";
import { assertActiveAbsenceCapacity } from "@/lib/absence-service";
import { isPrismaErrorCode } from "@/lib/prisma-errors";

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
  const data = await parseAbsenceRequest(request, routeInfo);
  if (!(await prisma.absence.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) {
    return notFound(id, "PUT", user.id);
  }
  await assertActiveAbsenceCapacity(user.id, { endDate: data.endDate, excludeId: id }, routeInfo);

  let absence;
  try {
    absence = await prisma.absence.update({ where: { id, userId: user.id }, data });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return notFound(id, "PUT", user.id);
    }
    throw error;
  }

  logInfo("absence_updated", "Absence updated", { userId: user.id, absenceId: id });

  return NextResponse.json(serializeAbsence(absence), { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "PUT" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/abwesenheiten/[id]">
) => {
  validateCsrfHeaders(request);
  const user = await requireMember();
  const { id } = await ctx.params;

  const { count } = await prisma.absence.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) {
    return notFound(id, "DELETE", user.id);
  }

  logInfo("absence_deleted", "Absence deleted", { userId: user.id, absenceId: id });

  return NextResponse.json({ success: true }, { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "DELETE" });

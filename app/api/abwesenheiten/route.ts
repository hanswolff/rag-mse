import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo } from "@/lib/logger";
import { parseAbsenceRequest, serializeAbsence } from "@/lib/absence-request";
import { assertActiveAbsenceCapacity, listOwnAbsences } from "@/lib/absence-service";

const ROUTE = "/api/abwesenheiten";

export const GET = withApiErrorHandling(async () => {
  const user = await requireMember();
  const absences = await listOwnAbsences(user.id);
  return NextResponse.json({ absences }, { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  const user = await requireMember();

  const routeInfo = { route: ROUTE, method: "POST" };
  const data = await parseAbsenceRequest(request, routeInfo);
  await assertActiveAbsenceCapacity(user.id, { endDate: data.endDate }, routeInfo);
  const absence = await prisma.absence.create({ data: { ...data, userId: user.id } });

  logInfo("absence_created", "Absence created", { userId: user.id, absenceId: absence.id });

  return NextResponse.json(serializeAbsence(absence), { status: 201, headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "POST" });

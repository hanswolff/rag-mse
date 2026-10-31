import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo } from "@/lib/logger";
import { parseAbsenceRequest, serializeAbsence } from "@/lib/absence-request";
import { createAbsence, listOwnAbsences } from "@/lib/absence-service";

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
  const absence = await createAbsence(user, await parseAbsenceRequest(request, routeInfo), routeInfo);

  logInfo("absence_created", "Absence created", { userId: absence.userId, actorId: user.id, absenceId: absence.id });

  return NextResponse.json(serializeAbsence(absence), { status: 201, headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "POST" });

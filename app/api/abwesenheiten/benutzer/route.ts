import { NextResponse } from "next/server";
import { ForbiddenError, requireMember } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { Permissions } from "@/lib/permissions";
import { listAbsenceOwnerOptions } from "@/lib/absence-service";

export const GET = withApiErrorHandling(async () => {
  const user = await requireMember();
  if (!Permissions.canManageAllAbsences(user)) {
    throw new ForbiddenError("Keine Berechtigung für Abwesenheiten anderer Benutzer");
  }
  const users = await listAbsenceOwnerOptions();
  return NextResponse.json({ users }, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/abwesenheiten/benutzer", method: "GET" });

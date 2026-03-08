import { NextRequest, NextResponse } from "next/server";
import { createImpersonationStopProof } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-utils";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logWarn } from "@/lib/logger";

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const effectiveUser = await requireAuth();
  const actor = effectiveUser.impersonatedBy;

  if (!effectiveUser.isImpersonating || !actor?.id) {
    logWarn("impersonation_stop_denied", "Stop requested without active impersonation", {
      effectiveUserId: effectiveUser.id,
      effectiveRole: effectiveUser.role,
    });
    return NextResponse.json({ error: "Keine aktive Impersonierung gefunden" }, { status: 400 });
  }

  const proof = createImpersonationStopProof(actor.id, effectiveUser.id);
  logInfo("impersonation_stop_issued", "Impersonation stop proof issued", {
    actorUserId: actor.id,
    effectiveUserId: effectiveUser.id,
  });

  return NextResponse.json({ proof });
}, { route: "/api/auth/impersonation/stop", method: "POST" });

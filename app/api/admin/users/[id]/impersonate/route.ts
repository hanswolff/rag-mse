import { NextRequest, NextResponse } from "next/server";
import { createImpersonationStartProof } from "@/lib/auth";
import { requireAuth, ForbiddenError } from "@/lib/auth-utils";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { Permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logInfo, logResourceNotFound, logWarn } from "@/lib/logger";

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[id]/impersonate">
) => {
  validateCsrfHeaders(request);

  const actor = await requireAuth();
  if (!Permissions.isSiteAdministrator(actor)) {
    throw new ForbiddenError("Keine Berechtigung");
  }

  if (actor.isImpersonating) {
    logWarn("impersonation_start_denied", "Nested impersonation attempt blocked", {
      actorUserId: actor.id,
      actorRole: actor.role,
    });
    return NextResponse.json(
      { error: "Eine verschachtelte Impersonierung ist nicht erlaubt" },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  if (id === actor.id) {
    return NextResponse.json(
      { error: "Sie können sich nicht selbst impersonieren" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!target) {
    logResourceNotFound("user", id, "/api/admin/users/[id]/impersonate", "POST");
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const proof = createImpersonationStartProof(actor.id, target.id);
  logInfo("impersonation_start_issued", "Impersonation start proof issued", {
    actorUserId: actor.id,
    actorRole: actor.role,
    targetUserId: target.id,
    targetRole: target.role,
  });

  return NextResponse.json({
    proof,
    target: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
    },
  });
}, { route: "/api/admin/users/[id]/impersonate", method: "POST" });

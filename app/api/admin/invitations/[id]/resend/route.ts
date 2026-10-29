import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { reissueInvitation } from "@/lib/invitations";
import { getAppUrl } from "@/lib/site-config";

export const POST = withApiErrorHandling(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");
  const { id: invitationId } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { invitedBy: true },
  });

  if (!invitation) {
    return NextResponse.json(
      { error: "Einladung nicht gefunden" },
      { status: 404 }
    );
  }

  if (invitation.usedAt) {
    return NextResponse.json(
      { error: "Einladung wurde bereits verwendet" },
      { status: 409 }
    );
  }

  const appUrl = getAppUrl();

  const result = await reissueInvitation({
    invitation,
    appUrl,
    logContext: {
      route: "/api/admin/invitations/[id]/resend",
      method: "POST",
      userEmail: invitation.invitedBy?.email,
    },
  });

  if (!result.emailSent) {
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Einladung wurde erneut versendet." },
    { status: 200 }
  );
}, { route: "/api/admin/invitations/[id]/resend", method: "POST" });

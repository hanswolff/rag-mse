import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { validateEmail } from "@/lib/user-validation";
import { reissueInvitation } from "@/lib/invitations";
import { getAppUrl } from "@/lib/site-config";

const ROUTE = "/api/admin/invitations/resend-by-email";

interface ResendByEmailRequest {
  email: string;
}

const resendByEmailSchema = {
  email: { type: 'string' as const },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");
  const body = await parseAndValidateBody<ResendByEmailRequest>(request, resendByEmailSchema, { route: ROUTE, method: 'POST' });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !validateEmail(email).isValid) {
    return NextResponse.json(
      { error: "Ungültiges E-Mail-Format" },
      { status: 400 }
    );
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      email,
      usedAt: null,
    },
    include: { invitedBy: true },
  });

  if (!invitation) {
    return NextResponse.json(
      { error: "Keine Einladung für diese E-Mail gefunden" },
      { status: 404 }
    );
  }

  const appUrl = getAppUrl();

  const result = await reissueInvitation({
    invitation,
    appUrl,
    logContext: {
      route: ROUTE,
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
}, { route: ROUTE, method: "POST" });

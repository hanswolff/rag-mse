import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateEmail } from "@/lib/user-validation";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { logValidationFailure, maskEmail } from "@/lib/logger";
import { findUserIdByEmailIgnoringCase, issueInvitation } from "@/lib/invitations";
import { getAppUrl } from "@/lib/site-config";

const ROUTE = "/api/admin/invitations";

interface InviteRequest {
  email: string;
}

const inviteSchema = {
  email: { type: 'string' as const },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin("write");
  const body = await parseAndValidateBody<InviteRequest>(request, inviteSchema, { route: ROUTE, method: 'POST' });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !validateEmail(email).isValid) {
    logValidationFailure(ROUTE, 'POST', 'Ungültiges E-Mail-Format', {
      email: body.email,
    });
    return NextResponse.json(
      { error: "Ungültiges E-Mail-Format" },
      { status: 400 }
    );
  }

  if (await findUserIdByEmailIgnoringCase(prisma, email)) {
    return NextResponse.json(
      { error: "Ein Benutzer mit dieser E-Mail existiert bereits" },
      { status: 409 }
    );
  }

  const appUrl = getAppUrl();

  const result = await issueInvitation({
    email,
    invitedById: admin.id,
    appUrl,
    logContext: {
      route: ROUTE,
      method: "POST",
      ...(admin.email && { userEmail: maskEmail(admin.email) }),
    },
  });

  if (!result.emailSent) {
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Einladung wurde erfolgreich erstellt und versendet." },
    { status: 200 }
  );
}, { route: ROUTE, method: "POST" });

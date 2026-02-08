import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, BadRequestError, withApiErrorHandling, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { validateEmail } from "@/lib/user-validation";
import {
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate,
  buildInviteUrl,
  sendInvitationEmail,
} from "@/lib/invitations";
import { logWarn } from "@/lib/logger";

interface ResendByEmailRequest {
  email: string;
}

const resendByEmailSchema = {
  email: { type: 'string' as const },
} as const;
const INVITED_AT_EPOCH = new Date("1970-01-01T00:00:00.000Z");

async function rollbackInvitationToken(invitationId: string, previousTokenHash: string, previousExpiresAt: Date): Promise<void> {
  try {
    await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        tokenHash: previousTokenHash,
        expiresAt: previousExpiresAt,
      },
    });
  } catch (rollbackError) {
    logWarn("invitation_resend_rollback_failed", "Failed to rollback invitation token after email failure", {
      invitationId,
      error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
    });
  }
}

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin();
  const body = await parseJsonBody<ResendByEmailRequest>(request);
  const bodyValidation = validateRequestBody(
    body as unknown as Record<string, unknown>,
    resendByEmailSchema,
    { route: '/api/admin/invitations/resend-by-email', method: 'POST' }
  );

  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !validateEmail(email)) {
    return NextResponse.json(
      { error: "Ungültiges E-Mail-Format" },
      { status: 400 }
    );
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { invitedBy: true },
  });

  if (!invitation) {
    return NextResponse.json(
      { error: "Keine aktive Einladung für diese E-Mail gefunden" },
      { status: 404 }
    );
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new BadRequestError("APP_URL ist nicht konfiguriert");
  }

  const newToken = generateInvitationToken();
  const newTokenHash = hashInvitationToken(newToken);

  await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
    await tx.invitation.updateMany({
      where: {
        email,
        usedAt: null,
        NOT: { id: invitation.id },
      },
      data: {
        usedAt: INVITED_AT_EPOCH,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: newTokenHash,
        expiresAt: getInvitationExpiryDate(),
      },
    });
  });

  const inviteUrl = buildInviteUrl(appUrl, newToken);

  const result = await sendInvitationEmail({
    email,
    inviteUrl,
    logContext: {
      route: "/api/admin/invitations/resend-by-email",
      method: "POST",
      invitationId: invitation.id,
      userEmail: invitation.invitedBy?.email,
    },
  });

  if (!result.success) {
    await rollbackInvitationToken(invitation.id, invitation.tokenHash, invitation.expiresAt);
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Einladung wurde erneut versendet." },
    { status: 200 }
  );
}, { route: "/api/admin/invitations/resend-by-email", method: "POST" });

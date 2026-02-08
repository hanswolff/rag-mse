import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { BadRequestError, withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import {
  buildInviteUrl,
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate,
  sendInvitationEmail,
} from "@/lib/invitations";
import { logWarn } from "@/lib/logger";

const INVITED_AT_EPOCH = new Date("1970-01-01T00:00:00.000Z");
type InvitationTransactionClient = {
  invitation: Pick<typeof prisma.invitation, "updateMany" | "update">;
};

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

export const POST = withApiErrorHandling(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  validateCsrfHeaders(request);
  await requireAdmin();
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
      { status: 400 }
    );
  }

  if (invitation.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "Einladung ist abgelaufen" },
      { status: 400 }
    );
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new BadRequestError("APP_URL ist nicht konfiguriert");
  }

  const newToken = generateInvitationToken();
  const newTokenHash = hashInvitationToken(newToken);

  await prisma.$transaction(async (tx: InvitationTransactionClient) => {
    await tx.invitation.updateMany({
      where: {
        email: invitation.email,
        usedAt: null,
        NOT: { id: invitationId },
      },
      data: {
        usedAt: INVITED_AT_EPOCH,
      },
    });

    await tx.invitation.update({
      where: { id: invitationId },
      data: {
        tokenHash: newTokenHash,
        expiresAt: getInvitationExpiryDate(),
      },
    });
  });

  const inviteUrl = buildInviteUrl(appUrl, newToken);

  const result = await sendInvitationEmail({
    email: invitation.email,
    inviteUrl,
    logContext: {
      route: "/api/admin/invitations/[id]/resend",
      method: "POST",
      invitationId: invitationId,
      userEmail: invitation.invitedBy?.email,
    },
  });

  if (!result.success) {
    await rollbackInvitationToken(invitationId, invitation.tokenHash, invitation.expiresAt);
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

import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sendTemplateEmail } from "./email-sender";
import { logInfo, logWarn } from "./logger";
import { logApiError } from "./api-error-handler";
import { generateRandomToken, hashToken } from "./crypto-utils";
import { appName } from "./site-config";

export const INVITATION_VALIDITY_DAYS = 14;
export const INVITATION_EMAIL_TEMPLATE = "einladung-zur-rag-mse";

export function generateInvitationToken(): string {
  return generateRandomToken();
}

export function hashInvitationToken(token: string): string {
  return hashToken(token);
}

export function getInvitationExpiryDate(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + INVITATION_VALIDITY_DAYS);
  return expiresAt;
}

export function buildInviteUrl(appUrl: string, token: string): string {
  const normalized = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${normalized}/einladung/${token}`;
}

export interface SendInvitationEmailOptions {
  email: string;
  inviteUrl: string;
  logContext?: Partial<{
    route: string;
    method: string;
    invitationId: string;
    userEmail: string;
    userId: string;
  }>;
}

export async function sendInvitationEmail({
  email,
  inviteUrl,
  logContext = {}
}: SendInvitationEmailOptions): Promise<{ success: boolean; error?: Error }> {
  try {
    await sendTemplateEmail({
      template: INVITATION_EMAIL_TEMPLATE,
      variables: {
        appName,
        inviteUrl,
        inviteValidityDays: String(INVITATION_VALIDITY_DAYS),
      },
      to: email,
    });

    logInfo('invitation_email_queued', 'Invitation email queued', {
      email,
      ...logContext,
      inviteValidityDays: INVITATION_VALIDITY_DAYS,
    });

    return { success: true };
  } catch (emailError) {
    logApiError(emailError, {
      route: logContext.route || "unknown",
      method: logContext.method || "unknown",
      status: 500,
      email,
      invitationId: logContext.invitationId,
      userId: logContext.userId,
      userEmail: logContext.userEmail,
      action: "send_invitation_email",
    });

    return { success: false, error: emailError instanceof Error ? emailError : new Error(String(emailError)) };
  }
}

export type InvitationLogContext = {
  route: string;
  method: string;
  userEmail?: string;
};

export function createInvitationTokenSet(now = new Date()): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = generateInvitationToken();
  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt: getInvitationExpiryDate(now),
  };
}

// Einladungen werden normalisiert gespeichert, Bestandskonten können noch eine
// Adresse mit Großbuchstaben tragen.
export async function findUserIdByEmailIgnoringCase(
  db: Pick<Prisma.TransactionClient, "user" | "$queryRaw">,
  email: string
): Promise<string | null> {
  const exact = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exact) return exact.id;
  const rows = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE lower("email") = lower(${email}) LIMIT 1`;
  return rows[0]?.id ?? null;
}

export async function invalidateOpenInvitations(
  db: Pick<Prisma.TransactionClient, "invitation">,
  email: string
): Promise<void> {
  await db.invitation.updateMany({
    where: { email: { in: [...new Set([email, email.trim().toLowerCase()])] }, usedAt: null },
    data: { usedAt: new Date() },
  });
}

// Offene Einladungen derselben Adresse entwerten, damit immer nur der zuletzt
// versendete Link gültig ist.
export async function invalidateOtherOpenInvitations(
  db: Pick<Prisma.TransactionClient, "invitation">,
  email: string,
  exclude: { invitationId: string } | { tokenHash: string }
): Promise<void> {
  await db.invitation.updateMany({
    where: {
      email,
      usedAt: null,
      NOT: "invitationId" in exclude ? { id: exclude.invitationId } : { tokenHash: exclude.tokenHash },
    },
    data: {
      usedAt: new Date(),
    },
  });
}

async function rollbackCreatedInvitation(invitationId: string): Promise<void> {
  try {
    await prisma.invitation.delete({
      where: { id: invitationId },
    });
  } catch (rollbackError) {
    logInfo("invitation_create_rollback_failed", "Failed to delete created invitation after email failure", {
      invitationId,
      error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
    });
  }
}

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

// Neue Einladung: anlegen → E-Mail → bei Erfolg alte Einladungen entwerten,
// bei E-Mail-Fehler die angelegte Einladung wieder löschen.
export async function issueInvitation(options: {
  email: string;
  invitedById: string;
  appUrl: string;
  logContext: InvitationLogContext;
}): Promise<{ emailSent: boolean }> {
  const { token, tokenHash, expiresAt } = createInvitationTokenSet();

  const invitation = await prisma.invitation.create({
    data: {
      email: options.email,
      tokenHash,
      expiresAt,
      invitedById: options.invitedById,
    },
  });

  const result = await sendInvitationEmail({
    email: options.email,
    inviteUrl: buildInviteUrl(options.appUrl, token),
    logContext: {
      ...options.logContext,
      invitationId: invitation.id,
    },
  });

  if (!result.success) {
    await rollbackCreatedInvitation(invitation.id);
    return { emailSent: false };
  }

  await invalidateOtherOpenInvitations(prisma, options.email, { invitationId: invitation.id });

  return { emailSent: true };
}

// Bestehende Einladung erneut versenden: neuer Token in einer Transaktion
// (andere offene Einladungen entwerten), dann E-Mail; bei E-Mail-Fehler den
// vorherigen Token wiederherstellen.
export async function reissueInvitation(options: {
  invitation: { id: string; email: string; tokenHash: string; expiresAt: Date };
  appUrl: string;
  logContext: InvitationLogContext;
}): Promise<{ emailSent: boolean }> {
  const { invitation } = options;
  const { token, tokenHash, expiresAt } = createInvitationTokenSet();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await invalidateOtherOpenInvitations(tx, invitation.email, { invitationId: invitation.id });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        expiresAt,
      },
    });
  });

  const result = await sendInvitationEmail({
    email: invitation.email,
    inviteUrl: buildInviteUrl(options.appUrl, token),
    logContext: {
      ...options.logContext,
      invitationId: invitation.id,
    },
  });

  if (!result.success) {
    await rollbackInvitationToken(invitation.id, invitation.tokenHash, invitation.expiresAt);
    return { emailSent: false };
  }

  return { emailSent: true };
}

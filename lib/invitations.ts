import { sendTemplateEmail } from "./email-sender";
import { logInfo } from "./logger";
import { logApiError } from "./api-utils";
import { generateRandomToken, hashToken } from "./crypto-utils";

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
  const appName = process.env.APP_NAME || "RAG Schießsport MSE";

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

import { sendTemplateEmail } from "./email-sender";
import { logInfo } from "./logger";
import { logApiError } from "./api-utils";
import { Permissions } from "./permissions";

export const ROLE_CHANGE_EMAIL_TEMPLATE = "rollenaenderung";

function getRoleDescription(role: string): string {
  switch (role) {
    case "SITE_ADMINISTRATOR":
      return "Als Site-Administrator haben Sie vollen Zugriff auf alle Funktionen der Anwendung, einschließlich der Verwaltung anderer Administratoren.";
    case "ADMIN":
      return "Als Administrator können Sie Benutzer verwalten, Termine erstellen und bearbeiten, News veröffentlichen und Dokumente hochladen.";
    case "AUDITOR":
      return "Als Prüfer haben Sie Lesezugriff auf administrative Bereiche wie Benutzerverwaltung, Termine und Dokumente, können aber keine Änderungen vornehmen.";
    case "MEMBER":
      return "Als Mitglied können Sie Ihre Termine einsehen, an Abstimmungen teilnehmen und Ihr Profil verwalten.";
    default:
      return "Bitte wenden Sie sich an einen Administrator, um mehr über Ihre Berechtigungen zu erfahren.";
  }
}

export interface SendRoleChangeEmailOptions {
  email: string;
  userName: string;
  oldRole: string;
  newRole: string;
  changedByName: string;
  logContext?: Partial<{
    route: string;
    method: string;
    userId: string;
    userEmail: string;
  }>;
}

export async function sendRoleChangeEmail({
  email,
  userName,
  oldRole,
  newRole,
  changedByName,
  logContext = {},
}: SendRoleChangeEmailOptions): Promise<{ success: boolean; error?: Error }> {
  const appName = process.env.APP_NAME || "RAG Schießsport MSE";
  const appUrl = process.env.APP_URL || "";

  const oldRoleLabel = Permissions.getRoleLabel(oldRole);
  const newRoleLabel = Permissions.getRoleLabel(newRole);
  const roleDescription = getRoleDescription(newRole);

  try {
    await sendTemplateEmail({
      template: ROLE_CHANGE_EMAIL_TEMPLATE,
      variables: {
        appName,
        appUrl,
        userName,
        oldRole: oldRoleLabel,
        newRole: newRoleLabel,
        roleDescription,
        changedByName,
      },
      to: email,
    });

    logInfo("role_change_email_queued", "Role change email queued", {
      email,
      oldRole,
      newRole,
      ...logContext,
    });

    return { success: true };
  } catch (emailError) {
    logApiError(emailError, {
      route: logContext.route || "unknown",
      method: logContext.method || "unknown",
      status: 500,
      email,
      userId: logContext.userId,
      userEmail: logContext.userEmail,
      action: "send_role_change_email",
    });

    return {
      success: false,
      error: emailError instanceof Error ? emailError : new Error(String(emailError)),
    };
  }
}

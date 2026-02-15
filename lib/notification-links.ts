export function normalizeAppUrl(appUrl: string): string {
  return appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
}

export function buildNotificationRsvpUrl(appUrl: string, token: string): string {
  return `${normalizeAppUrl(appUrl)}/anmeldung/${token}`;
}

export function buildNotificationUnsubscribeUrl(appUrl: string, token: string): string {
  return `${normalizeAppUrl(appUrl)}/benachrichtigungen/abmelden/${token}`;
}

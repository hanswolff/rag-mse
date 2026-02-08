import { generateRandomToken, hashToken } from "./crypto-utils";

export const RESET_TOKEN_VALIDITY_HOURS = 24;

export function generateResetToken(): string {
  return generateRandomToken();
}

export function hashResetToken(token: string): string {
  return hashToken(token);
}

export function getResetExpiryDate(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_VALIDITY_HOURS);
  return expiresAt;
}

export function buildResetUrl(appUrl: string, token: string): string {
  const normalized = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${normalized}/passwort-zuruecksetzen/${token}`;
}

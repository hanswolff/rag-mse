import { Event } from "@prisma/client";
import { renderTemplateEmail, type RenderedEmail } from "../email-sender";
import { generateRandomToken, hashToken } from "../crypto-utils";
import { formatDate, formatTime } from "../date-utils";
import { formatDateForStorage } from "../date-picker-utils";
import { buildNotificationRsvpUrl, buildNotificationUnsubscribeUrl, normalizeAppUrl } from "./notification-links";
import { buildCalendarEvent } from "../calendar";
import { buildEventDateTime } from "../dates";
import { appName } from "../site-config";
import { envInt } from "../env";

export const EVENT_REMINDER_EMAIL_TEMPLATE = "termin-erinnerung";

const DEFAULT_TOKEN_VALIDITY_DAYS = 60;

export function generateNotificationToken(): string {
  return generateRandomToken();
}

export function hashNotificationToken(token: string): string {
  return hashToken(token);
}

export function getNotificationTokenValidityDays(): number {
  return envInt("NOTIFICATION_TOKEN_VALIDITY_DAYS", DEFAULT_TOKEN_VALIDITY_DAYS);
}

export function getNotificationTokenExpiryDate(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + getNotificationTokenValidityDays());
  return expiresAt;
}

export { buildNotificationRsvpUrl, buildNotificationUnsubscribeUrl, normalizeAppUrl };

interface EventReminderEmailOptions {
  email: string;
  event: Pick<Event, "id" | "date" | "timeFrom" | "timeTo" | "location" | "title" | "type">;
  daysBefore: number;
  rsvpUrl: string;
  unsubscribeUrl: string;
}

// Ohne Titel bleibt die Erinnerung wortgleich wie bisher; deshalb steht der
// Kopfblock als eine Variable direkt vor der Datumszeile.
function buildEventHeadline(event: Pick<Event, "title" | "type">): string {
  if (!event.title) {
    return "";
  }

  const lines = [`Titel: ${event.title}`];
  if (event.type) {
    lines.push(`Terminart: ${event.type}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildEventReminderEmailVariables(
  event: Pick<Event, "date" | "timeFrom" | "timeTo" | "location" | "title" | "type">,
  { daysBefore, rsvpUrl, unsubscribeUrl }: { daysBefore: number; rsvpUrl: string; unsubscribeUrl: string },
): Record<string, string> {
  return {
    appName,
    daysBefore: String(daysBefore),
    eventHeadline: buildEventHeadline(event),
    eventDate: formatDate(event.date.toISOString()),
    eventTimeFrom: formatTime(event.timeFrom),
    eventTimeTo: formatTime(event.timeTo),
    eventLocation: event.location,
    rsvpUrl,
    unsubscribeUrl,
  };
}

function buildEventCalendarAttachment(event: Pick<Event, "id" | "date" | "timeFrom" | "timeTo" | "location">): {
  filename: string;
  content: string;
  contentType: string;
} {
  const start = buildEventDateTime(event.date, event.timeFrom);
  const end = buildEventDateTime(event.date, event.timeTo);
  const safeEnd = end > start ? end : new Date(start.getTime() + 60 * 60 * 1000);

  const content = buildCalendarEvent({
    uid: `event-${event.id}@rag-mse`,
    title: `${appName} Termin`,
    description: `Termin der ${appName}`,
    location: event.location,
    start,
    end: safeEnd,
  });

  return {
    filename: `rag-mse-termin-${formatDateForStorage(event.date)}.ics`,
    content,
    contentType: "text/calendar; charset=utf-8; method=PUBLISH",
  };
}

export function renderEventReminderEmail({
  email,
  event,
  daysBefore,
  rsvpUrl,
  unsubscribeUrl,
}: EventReminderEmailOptions): Promise<RenderedEmail> {
  return renderTemplateEmail({
    template: EVENT_REMINDER_EMAIL_TEMPLATE,
    to: email,
    variables: buildEventReminderEmailVariables(event, { daysBefore, rsvpUrl, unsubscribeUrl }),
    attachments: [buildEventCalendarAttachment(event)],
  });
}

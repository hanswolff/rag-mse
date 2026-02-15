import { Event } from "@prisma/client";
import { sendTemplateEmail } from "./email-sender";
import { generateRandomToken, hashToken } from "./crypto-utils";
import { formatDate, formatTime } from "./date-utils";
import { formatDateForStorage } from "./date-picker-utils";
import { logApiError } from "./api-utils";
import { logInfo } from "./logger";
import { buildNotificationRsvpUrl, buildNotificationUnsubscribeUrl, normalizeAppUrl } from "./notification-links";
import { buildCalendarEvent } from "./calendar";

export const EVENT_REMINDER_EMAIL_TEMPLATE = "termin-erinnerung";

const DEFAULT_TOKEN_VALIDITY_DAYS = 60;

export function generateNotificationToken(): string {
  return generateRandomToken();
}

export function hashNotificationToken(token: string): string {
  return hashToken(token);
}

export function getNotificationTokenValidityDays(): number {
  const raw = process.env.NOTIFICATION_TOKEN_VALIDITY_DAYS;
  if (!raw) {
    return DEFAULT_TOKEN_VALIDITY_DAYS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_TOKEN_VALIDITY_DAYS;
  }
  return parsed;
}

export function getNotificationTokenExpiryDate(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + getNotificationTokenValidityDays());
  return expiresAt;
}

export { buildNotificationRsvpUrl, buildNotificationUnsubscribeUrl, normalizeAppUrl };

interface SendEventReminderEmailOptions {
  email: string;
  event: Pick<Event, "id" | "date" | "timeFrom" | "timeTo" | "location">;
  daysBefore: number;
  rsvpUrl: string;
  unsubscribeUrl: string;
}

function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10));
  return {
    hours: Number.isInteger(hours) ? hours : 0,
    minutes: Number.isInteger(minutes) ? minutes : 0,
  };
}

function buildEventDateTime(baseDate: Date, time: string): Date {
  const { hours, minutes } = parseTimeParts(time);
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0
  );
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
    title: "RAG Schießsport MSE Termin",
    description: "Termin der RAG Schießsport MSE",
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

export async function sendEventReminderEmail({
  email,
  event,
  daysBefore,
  rsvpUrl,
  unsubscribeUrl,
}: SendEventReminderEmailOptions): Promise<{ success: boolean; error?: Error }> {
  const appName = process.env.APP_NAME || "RAG Schießsport MSE";

  try {
    await sendTemplateEmail({
      template: EVENT_REMINDER_EMAIL_TEMPLATE,
      to: email,
      variables: {
        appName,
        daysBefore: String(daysBefore),
        eventDate: formatDate(event.date.toISOString()),
        eventTimeFrom: formatTime(event.timeFrom),
        eventTimeTo: formatTime(event.timeTo),
        eventLocation: event.location,
        rsvpUrl,
        unsubscribeUrl,
      },
      attachments: [buildEventCalendarAttachment(event)],
    });

    logInfo("event_reminder_email_queued", "Event reminder email queued", {
      eventId: event.id,
      email,
      daysBefore,
    });

    return { success: true };
  } catch (error) {
    logApiError(error, {
      route: "/worker/event-reminders",
      method: "SYSTEM",
      status: 500,
      eventId: event.id,
      email,
      daysBefore,
      action: "send_event_reminder_email",
    });

    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

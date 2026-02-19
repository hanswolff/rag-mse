import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  buildNotificationRsvpUrl,
  buildNotificationUnsubscribeUrl,
  generateNotificationToken,
  getNotificationTokenExpiryDate,
  hashNotificationToken,
  sendEventReminderEmail,
} from "./notifications";
import { logError, logInfo } from "./logger";

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_NOTIFICATION_TIMEZONE = "Europe/Berlin";
const PENDING_DISPATCH_RESEND_DELAY_MS = 6 * 60 * 60 * 1000;
const SENT_AT_UPDATE_MAX_ATTEMPTS = 3;
const REMINDER_GRACE_PERIOD_MS = 2 * 60 * 1000;

const globalForReminderWorker = globalThis as typeof globalThis & {
  eventReminderWorkerStarted?: boolean;
  eventReminderTickRunning?: boolean;
  eventReminderTimer?: NodeJS.Timeout;
};

function getPollIntervalMs(): number {
  const raw = process.env.EVENT_REMINDER_POLL_INTERVAL_MS;
  if (!raw) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_POLL_INTERVAL_MS;
}

function getNotificationTimeZone(): string {
  return process.env.APP_TIMEZONE?.trim() || DEFAULT_NOTIFICATION_TIMEZONE;
}

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneDateParts(date: Date, timeZone: string): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number.parseInt(value || "0", 10);
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getTimeZoneDateParts(date, timeZone);
  const utcFromZoned = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
    0
  );
  return utcFromZoned - date.getTime();
}

function zonedTimeToUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}, timeZone: string): Date {
  const second = parts.second ?? 0;
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, second, 0);
  let utcGuess = targetUtc;

  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
    utcGuess = targetUtc - offset;
  }

  return new Date(utcGuess);
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return true;
  }

  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "P2002"
  ) {
    return true;
  }

  return false;
}

async function queueReminderForUserEvent(params: {
  userId: string;
  userEmail: string;
  event: {
    id: string;
    date: Date;
    timeFrom: string;
    timeTo: string;
    location: string;
  };
  daysBefore: number;
  appUrl: string;
  now: Date;
}): Promise<boolean> {
  const tokenExpiresAt = getNotificationTokenExpiryDate(params.now);

  const sendAndFinalizeDispatch = async (
    dispatchId: string,
    rsvpToken: string,
    unsubscribeToken: string
  ): Promise<boolean> => {
    const result = await sendEventReminderEmail({
      email: params.userEmail,
      event: params.event,
      daysBefore: params.daysBefore,
      rsvpUrl: buildNotificationRsvpUrl(params.appUrl, rsvpToken),
      unsubscribeUrl: buildNotificationUnsubscribeUrl(params.appUrl, unsubscribeToken),
    });

    if (!result.success) {
      return false;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= SENT_AT_UPDATE_MAX_ATTEMPTS; attempt += 1) {
      try {
        await prisma.eventReminderDispatch.update({
          where: { id: dispatchId },
          data: { sentAt: new Date() },
          select: { id: true },
        });
        return true;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Could not update sentAt for dispatch ${dispatchId}`);
  };

  const recoverPendingDispatch = async (): Promise<boolean> => {
    const existingDispatch = await prisma.eventReminderDispatch.findUnique({
      where: {
        userId_eventId: {
          userId: params.userId,
          eventId: params.event.id,
        },
      },
      select: {
        id: true,
        sentAt: true,
        queuedAt: true,
      },
    });

    if (!existingDispatch || existingDispatch.sentAt) {
      return false;
    }

    const queuedAtMs = existingDispatch.queuedAt.getTime();
    if (params.now.getTime() - queuedAtMs < PENDING_DISPATCH_RESEND_DELAY_MS) {
      return false;
    }

    for (let attempt = 0; attempt < SENT_AT_UPDATE_MAX_ATTEMPTS; attempt += 1) {
      const rsvpToken = generateNotificationToken();
      const unsubscribeToken = generateNotificationToken();
      const rsvpTokenHash = hashNotificationToken(rsvpToken);
      const unsubscribeTokenHash = hashNotificationToken(unsubscribeToken);

      try {
        await prisma.eventReminderDispatch.update({
          where: { id: existingDispatch.id },
          data: {
            daysBefore: params.daysBefore,
            rsvpTokenHash,
            rsvpTokenExpiresAt: tokenExpiresAt,
            unsubscribeTokenHash,
            unsubscribeTokenExpiresAt: tokenExpiresAt,
            queuedAt: params.now,
            sentAt: null,
          },
          select: { id: true },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }

      return sendAndFinalizeDispatch(existingDispatch.id, rsvpToken, unsubscribeToken);
    }

    return false;
  };

  const rsvpToken = generateNotificationToken();
  const unsubscribeToken = generateNotificationToken();
  const rsvpTokenHash = hashNotificationToken(rsvpToken);
  const unsubscribeTokenHash = hashNotificationToken(unsubscribeToken);

  let dispatchId: string | null = null;

  try {
    const dispatch = await prisma.eventReminderDispatch.create({
      data: {
        userId: params.userId,
        eventId: params.event.id,
        daysBefore: params.daysBefore,
        rsvpTokenHash,
        rsvpTokenExpiresAt: tokenExpiresAt,
        unsubscribeTokenHash,
        unsubscribeTokenExpiresAt: tokenExpiresAt,
        queuedAt: params.now,
      },
      select: { id: true },
    });
    dispatchId = dispatch.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return recoverPendingDispatch();
    }
    throw error;
  }

  const sentSuccessfully = dispatchId
    ? await sendAndFinalizeDispatch(dispatchId, rsvpToken, unsubscribeToken)
    : false;

  if (!sentSuccessfully && dispatchId) {
    await prisma.eventReminderDispatch.delete({
      where: { id: dispatchId },
    }).catch(() => undefined);
    return false;
  }

  return sentSuccessfully;
}

function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10));
  return {
    hours: Number.isInteger(hours) ? hours : 0,
    minutes: Number.isInteger(minutes) ? minutes : 0,
  };
}

function buildEventDateTime(eventDate: Date, time: string, timeZone: string): Date {
  const { hours, minutes } = parseTimeParts(time);
  const eventDateParts = getTimeZoneDateParts(eventDate, timeZone);
  return zonedTimeToUtc(
    {
      year: eventDateParts.year,
      month: eventDateParts.month,
      day: eventDateParts.day,
      hour: hours,
      minute: minutes,
      second: 0,
    },
    timeZone
  );
}

function shouldSendReminder(eventDateTime: Date, daysBefore: number, now: Date, pollIntervalMs: number): boolean {
  const reminderTime = new Date(eventDateTime.getTime() - daysBefore * 24 * 60 * 60 * 1000);
  const timeDiff = reminderTime.getTime() - now.getTime();
  return timeDiff >= -REMINDER_GRACE_PERIOD_MS && timeDiff < pollIntervalMs;
}

export async function processEventReminders(now = new Date()): Promise<number> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    logError("event_reminder_missing_app_url", "APP_URL is required for event reminder links");
    return 0;
  }

  const pollIntervalMs = getPollIntervalMs();
  const notificationTimeZone = getNotificationTimeZone();
  const users = await prisma.user.findMany({
    where: { eventReminderEnabled: true },
    select: {
      id: true,
      email: true,
      eventReminderDaysBefore: true,
    },
  });

  let queued = 0;

  for (const user of users) {
    const hoursBefore = user.eventReminderDaysBefore * 24;
    const searchWindowMs = pollIntervalMs + REMINDER_GRACE_PERIOD_MS;

    const minEventTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000 - REMINDER_GRACE_PERIOD_MS);
    const maxEventTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000 + searchWindowMs);

    const minEventDate = new Date(minEventTime);
    minEventDate.setHours(0, 0, 0, 0);

    const maxEventDate = new Date(maxEventTime);
    maxEventDate.setHours(23, 59, 59, 999);

    const eventsForRange = await prisma.event.findMany({
      where: {
        visible: true,
        date: {
          gte: minEventDate,
          lte: maxEventDate,
        },
        votes: {
          none: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
      },
    });

    for (const event of eventsForRange) {
      const eventDateTime = buildEventDateTime(event.date, event.timeFrom, notificationTimeZone);
      if (!shouldSendReminder(eventDateTime, user.eventReminderDaysBefore, now, pollIntervalMs)) {
        continue;
      }

      try {
        const queuedForEvent = await queueReminderForUserEvent({
          userId: user.id,
          userEmail: user.email,
          event,
          daysBefore: user.eventReminderDaysBefore,
          appUrl,
          now,
        });

        if (queuedForEvent) {
          queued += 1;
        }
      } catch (error) {
        logError("event_reminder_queue_failed", "Failed to queue reminder for user/event", {
          userId: user.id,
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return queued;
}

async function runWorkerTick(): Promise<void> {
  if (globalForReminderWorker.eventReminderTickRunning) {
    return;
  }

  globalForReminderWorker.eventReminderTickRunning = true;
  try {
    const queued = await processEventReminders();
    if (queued > 0) {
      logInfo("event_reminder_worker_processed", "Event reminders queued", { queued });
    }
  } catch (error) {
    logError("event_reminder_worker_error", "Event reminder worker tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    globalForReminderWorker.eventReminderTickRunning = false;
  }
}

export function startEventReminderWorker(): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (globalForReminderWorker.eventReminderWorkerStarted) {
    return;
  }

  globalForReminderWorker.eventReminderWorkerStarted = true;
  const pollIntervalMs = getPollIntervalMs();

  globalForReminderWorker.eventReminderTimer = setInterval(() => {
    void runWorkerTick();
  }, pollIntervalMs);

  void runWorkerTick();

  logInfo("event_reminder_worker_started", "Event reminder worker started", {
    pollIntervalMs,
    notificationTimeZone: getNotificationTimeZone(),
  });
}

export function stopEventReminderWorkerForTests(): void {
  if (globalForReminderWorker.eventReminderTimer) {
    clearInterval(globalForReminderWorker.eventReminderTimer);
  }

  globalForReminderWorker.eventReminderWorkerStarted = false;
  globalForReminderWorker.eventReminderTickRunning = false;
  globalForReminderWorker.eventReminderTimer = undefined;
}

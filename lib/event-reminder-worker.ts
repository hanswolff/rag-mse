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

const DEFAULT_POLL_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_NOTIFICATION_TIMEZONE = "Europe/Berlin";
const PENDING_DISPATCH_RESEND_DELAY_MS = 6 * 60 * 60 * 1000;
const SENT_AT_UPDATE_MAX_ATTEMPTS = 3;

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

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format date parts for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function getTargetDateKey(daysBefore: number, timeZone: string, now = new Date()): string {
  const targetDate = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);
  return formatDateKeyInTimeZone(targetDate, timeZone);
}

function getSearchRange(daysBefore: number, now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysBefore - 1);

  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  return { start, end };
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

export async function processEventReminders(now = new Date()): Promise<number> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    logError("event_reminder_missing_app_url", "APP_URL is required for event reminder links");
    return 0;
  }

  const users = await prisma.user.findMany({
    where: { eventReminderEnabled: true },
    select: {
      id: true,
      email: true,
      eventReminderDaysBefore: true,
    },
  });

  let queued = 0;
  const timeZone = getNotificationTimeZone();

  for (const user of users) {
    const { start, end } = getSearchRange(user.eventReminderDaysBefore, now);
    const targetDateKey = getTargetDateKey(user.eventReminderDaysBefore, timeZone, now);

    const eventsForRange = await prisma.event.findMany({
      where: {
        visible: true,
        date: {
          gte: start,
          lt: end,
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

    const events = eventsForRange.filter((event) => formatDateKeyInTimeZone(event.date, timeZone) === targetDateKey);

    for (const event of events) {
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

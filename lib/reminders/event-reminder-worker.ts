import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { isUniqueConstraintError } from "../prisma-errors";
import {
  buildNotificationRsvpUrl,
  buildNotificationUnsubscribeUrl,
  generateNotificationToken,
  getNotificationTokenExpiryDate,
  hashNotificationToken,
  renderEventReminderEmail,
} from "./notifications";
import { enqueueRenderedEmail } from "../email-sender";
import { logError, logInfo } from "../logger";
import { Permissions } from "../permissions";
import { buildEventDateTime, getAppTimeZone } from "../dates";
import { createIntervalWorker } from "../worker-runtime";
import { envInt } from "../env";
import { getVisibilityFilter } from "../visibility";

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getPollIntervalMs(): number {
  return envInt("EVENT_REMINDER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS);
}

type ReminderUser = {
  id: string;
  email: string;
  role: string;
  eventReminderDaysBefore: number;
};

type CandidateEvent = {
  id: string;
  date: Date;
  timeFrom: string;
  timeTo: string;
  location: string;
  title: string | null;
  type: string | null;
  votes: { userId: string }[];
  eventReminderDispatches: { userId: string }[];
};

type QueueReminderParams = {
  userId: string;
  userEmail: string;
  event: Omit<CandidateEvent, "votes" | "eventReminderDispatches">;
  daysBefore: number;
  appUrl: string;
  now: Date;
};

type DispatchTokens = {
  rsvpToken: string;
  unsubscribeToken: string;
  rsvpTokenHash: string;
  unsubscribeTokenHash: string;
};

function generateDispatchTokens(): DispatchTokens {
  const rsvpToken = generateNotificationToken();
  const unsubscribeToken = generateNotificationToken();

  return {
    rsvpToken,
    unsubscribeToken,
    rsvpTokenHash: hashNotificationToken(rsvpToken),
    unsubscribeTokenHash: hashNotificationToken(unsubscribeToken),
  };
}

// Erinnerung und E-Mail entstehen in einer Transaktion: Entweder ist beides
// gespeichert oder nichts. Die Unique-Constraint (userId, eventId) verhindert
// doppelte Erinnerungen über Prozesse hinweg.
async function queueReminderForUserEvent(params: QueueReminderParams): Promise<boolean> {
  const tokenExpiresAt = getNotificationTokenExpiryDate(params.now);
  const tokens = generateDispatchTokens();

  const email = await renderEventReminderEmail({
    email: params.userEmail,
    event: params.event,
    daysBefore: params.daysBefore,
    rsvpUrl: buildNotificationRsvpUrl(params.appUrl, tokens.rsvpToken),
    unsubscribeUrl: buildNotificationUnsubscribeUrl(params.appUrl, tokens.unsubscribeToken),
  });

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.eventReminderDispatch.create({
        data: {
          userId: params.userId,
          eventId: params.event.id,
          daysBefore: params.daysBefore,
          rsvpTokenHash: tokens.rsvpTokenHash,
          rsvpTokenExpiresAt: tokenExpiresAt,
          unsubscribeTokenHash: tokens.unsubscribeTokenHash,
          unsubscribeTokenExpiresAt: tokenExpiresAt,
          queuedAt: params.now,
          sentAt: params.now,
        },
        select: { id: true },
      });
      await enqueueRenderedEmail(email, tx);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }

  logInfo("event_reminder_email_queued", "Event reminder email queued", {
    eventId: params.event.id,
    email: params.userEmail,
    daysBefore: params.daysBefore,
  });

  return true;
}

function isReminderDue(eventDateTime: Date, daysBefore: number, now: Date, pollIntervalMs: number): boolean {
  const reminderTime = eventDateTime.getTime() - daysBefore * DAY_MS;
  return eventDateTime.getTime() > now.getTime() && reminderTime <= now.getTime() + pollIntervalMs;
}

function groupUsersByReminderDays(users: ReminderUser[]): Map<number, ReminderUser[]> {
  const groupedUsers = new Map<number, ReminderUser[]>();

  for (const user of users) {
    const usersForDays = groupedUsers.get(user.eventReminderDaysBefore) || [];
    usersForDays.push(user);
    groupedUsers.set(user.eventReminderDaysBefore, usersForDays);
  }

  return groupedUsers;
}

function isAlreadyHandled(event: CandidateEvent, userId: string): boolean {
  return (
    (event.votes ?? []).some((vote) => vote.userId === userId) ||
    (event.eventReminderDispatches ?? []).some((dispatch) => dispatch.userId === userId)
  );
}

// Fällig ist jede Erinnerung, deren Zeitpunkt spätestens im nächsten Intervall liegt,
// solange der Termin noch bevorsteht. Verpasste Zeitpunkte werden so nachgeholt.
// Vorhandene Vermerke und Teilnahmeanmeldungen werden vor dem Rendern ausgefiltert.
async function queueDueReminders(now: Date, eventId?: string): Promise<number> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    logError("event_reminder_missing_app_url", "APP_URL is required for event reminder links");
    return 0;
  }

  const pollIntervalMs = getPollIntervalMs();
  const notificationTimeZone = getAppTimeZone();

  const users = await prisma.user.findMany({
    where: {
      eventReminderEnabled: true,
      activatedAt: { not: null },
    },
    select: {
      id: true,
      email: true,
      role: true,
      eventReminderDaysBefore: true,
    },
  });

  const activeUsers = users.filter((user) => Permissions.canVoteAttendance(user.role));

  let queued = 0;

  for (const [daysBefore, usersForDays] of groupUsersByReminderDays(activeUsers)) {
    const userIds = usersForDays.map((user) => user.id);

    const eventsForRange = await prisma.event.findMany({
      where: {
        ...getVisibilityFilter(true),
        ...(eventId ? { id: eventId } : {}),
        date: {
          gte: new Date(now.getTime() - DAY_MS),
          lte: new Date(now.getTime() + (daysBefore + 1) * DAY_MS + pollIntervalMs),
        },
      },
      select: {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
        title: true,
        type: true,
        votes: {
          where: { userId: { in: userIds } },
          select: { userId: true },
        },
        eventReminderDispatches: {
          where: { userId: { in: userIds } },
          select: { userId: true },
        },
      },
    });

    for (const event of eventsForRange as CandidateEvent[]) {
      const eventDateTime = buildEventDateTime(event.date, event.timeFrom, notificationTimeZone);
      if (!isReminderDue(eventDateTime, daysBefore, now, pollIntervalMs)) {
        continue;
      }

      for (const user of usersForDays) {
        if (isAlreadyHandled(event, user.id)) {
          continue;
        }

        try {
          const queuedForEvent = await queueReminderForUserEvent({
            userId: user.id,
            userEmail: user.email,
            event: {
              id: event.id,
              date: event.date,
              timeFrom: event.timeFrom,
              timeTo: event.timeTo,
              location: event.location,
              title: event.title,
              type: event.type,
            },
            daysBefore,
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
  }

  return queued;
}

// Wer seine Teilnahmeanmeldung zurückzieht, nachdem die Erinnerung fällig war, hat
// bewusst entschieden: ein Vermerk ohne Versand (sentAt = null) verhindert das Nachholen.
export async function suppressCatchUpReminder(userId: string, eventId: string, now = new Date()): Promise<void> {
  const [user, event] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { eventReminderDaysBefore: true } }),
    prisma.event.findUnique({ where: { id: eventId }, select: { date: true, timeFrom: true } }),
  ]);
  if (!user || !event) return;

  const eventDateTime = buildEventDateTime(event.date, event.timeFrom, getAppTimeZone());
  if (!isReminderDue(eventDateTime, user.eventReminderDaysBefore, now, getPollIntervalMs())) return;

  const tokens = generateDispatchTokens();
  const tokenExpiresAt = getNotificationTokenExpiryDate(now);
  try {
    await prisma.eventReminderDispatch.create({
      data: {
        userId,
        eventId,
        daysBefore: user.eventReminderDaysBefore,
        rsvpTokenHash: tokens.rsvpTokenHash,
        rsvpTokenExpiresAt: tokenExpiresAt,
        unsubscribeTokenHash: tokens.unsubscribeTokenHash,
        unsubscribeTokenExpiresAt: tokenExpiresAt,
        queuedAt: now,
        sentAt: null,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }
}

export function processEventReminders(now = new Date()): Promise<number> {
  return queueDueReminders(now);
}

export function triggerImmediateEventReminders(eventId: string, now = new Date()): Promise<number> {
  return queueDueReminders(now, eventId);
}

const eventReminderWorker = createIntervalWorker({
  name: "event-reminder",
  getIntervalMs: getPollIntervalMs,
  tick: async () => {
    const queued = await processEventReminders();
    if (queued > 0) {
      logInfo("event_reminder_worker_processed", "Event reminders queued", { queued });
    }
  },
  onTickError: (error) => {
    logError("event_reminder_worker_error", "Event reminder worker tick failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  },
  onStarted: (pollIntervalMs) => {
    logInfo("event_reminder_worker_started", "Event reminder worker started", {
      pollIntervalMs,
      notificationTimeZone: getAppTimeZone(),
    });
  },
});

export function isEventReminderWorkerRunning(): boolean {
  return eventReminderWorker.isRunning();
}

export function startEventReminderWorker(): void {
  eventReminderWorker.start();
}

export function stopEventReminderWorkerForTests(): void {
  eventReminderWorker.stopForTests();
}

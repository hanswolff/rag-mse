import { prisma } from "@/lib/prisma";
import { PUT as putAdminEvent } from "@/app/api/admin/events/[id]/route";
import { DELETE as deleteVote } from "@/app/api/events/[id]/vote/route";
import { GET as getAdminNotifications } from "@/app/api/admin/notifications/route";
import { processEventReminders } from "@/lib/reminders/event-reminder-worker";
import { runMaintenanceCleanup } from "@/lib/maintenance-worker";
import { EVENT_REMINDER_EMAIL_TEMPLATE } from "@/lib/reminders/notifications";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import { createAdmin, createEvent, createUser } from "./helpers/factories";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Dienstag, 10.11.2026, 09:00 Uhr in Berlin (Winterzeit, UTC+1).
const START = new Date("2026-11-10T09:00:00+01:00");

// Nur Date wird eingefroren; Timer bleiben echt (Prisma arbeitet asynchron).
beforeEach(async () => {
  jest.useFakeTimers({
    now: START,
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
  await prisma.event.deleteMany();
  await prisma.user.updateMany({ data: { eventReminderEnabled: false } });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Kalendertag relativ zu START (lokale Zeitzone Europe/Berlin), 00:00 Uhr. */
function dayFromStart(days: number): Date {
  const day = new Date(START);
  day.setDate(day.getDate() + days);
  day.setHours(0, 0, 0, 0);
  return day;
}

function isoDay(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

function eventStart(day: Date, timeFrom = "10:00"): Date {
  const [hours, minutes] = timeFrom.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

function reminderCount(eventId: string, userId: string): Promise<number> {
  return prisma.eventReminderDispatch.count({ where: { eventId, userId } });
}

function reminderEmailCount(email: string): Promise<number> {
  return prisma.outgoingEmail.count({
    where: { template: EVENT_REMINDER_EMAIL_TEMPLATE, toRecipients: email },
  });
}

async function waitForReminder(eventId: string, userId: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await reminderCount(eventId, userId)) > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Keine Erinnerung für Termin ${eventId} und Benutzer ${userId}`);
}

async function putEvent(eventId: string, body: Record<string, unknown>) {
  const admin = await createAdmin({ eventReminderEnabled: false });
  loginAs(admin);
  return putAdminEvent(
    apiRequest("PUT", `/api/admin/events/${eventId}`, { body }),
    routeContext({ id: eventId })
  );
}

describe("Nachholen verpasster Termin-Erinnerungen", () => {
  it("holt eine Erinnerung nach, deren Zeitpunkt Stunden zurückliegt, und nur einmal", async () => {
    const user = await createUser({ eventReminderDaysBefore: 3 });
    const day = dayFromStart(5);
    const event = await createEvent({ date: day, timeFrom: "10:00" });
    const missedBy = new Date(eventStart(day).getTime() - 3 * DAY_MS + 6 * HOUR_MS);

    await expect(processEventReminders(missedBy)).resolves.toBe(1);
    await expect(processEventReminders(new Date(missedBy.getTime() + 5 * 60 * 1000))).resolves.toBe(0);

    expect(await reminderCount(event.id, user.id)).toBe(1);
    expect(await reminderEmailCount(user.email)).toBe(1);
  });

  it("erinnert noch kurz vor Terminbeginn, aber nicht mehr nach Beginn", async () => {
    const user = await createUser({ eventReminderDaysBefore: 7 });
    const day = dayFromStart(1);
    const started = await createEvent({ date: day, timeFrom: "08:00" });
    const upcoming = await createEvent({ date: day, timeFrom: "18:00" });

    await processEventReminders(new Date(eventStart(day, "08:00").getTime() + 30 * 60 * 1000));

    expect(await reminderCount(started.id, user.id)).toBe(0);
    expect(await reminderCount(upcoming.id, user.id)).toBe(1);
  });

  it("erinnert nicht früher als ein Intervall vor dem Erinnerungszeitpunkt", async () => {
    const user = await createUser({ eventReminderDaysBefore: 2 });
    const day = dayFromStart(6);
    const event = await createEvent({ date: day, timeFrom: "10:00" });
    const reminderAt = eventStart(day).getTime() - 2 * DAY_MS;

    await expect(processEventReminders(new Date(reminderAt - 10 * 60 * 1000))).resolves.toBe(0);
    await expect(processEventReminders(new Date(reminderAt - 4 * 60 * 1000))).resolves.toBe(1);
    expect(await reminderCount(event.id, user.id)).toBe(1);
  });

  it("ignoriert ausgeblendete Termine und bereits angemeldete Mitglieder", async () => {
    const voted = await createUser({ eventReminderDaysBefore: 7 });
    const silent = await createUser({ eventReminderDaysBefore: 7 });
    const visible = await createEvent({ date: dayFromStart(3) });
    const hidden = await createEvent({ date: dayFromStart(3), visibility: "HIDDEN" });
    await prisma.vote.create({ data: { userId: voted.id, eventId: visible.id, vote: "JA" } });

    await expect(processEventReminders()).resolves.toBe(1);
    expect(await reminderCount(visible.id, silent.id)).toBe(1);
    expect(await reminderCount(visible.id, voted.id)).toBe(0);
    expect(await prisma.eventReminderDispatch.count({ where: { eventId: hidden.id } })).toBe(0);
  });

  it("erinnert im nächsten Lauf, wenn ein Mitglied den Vorlauf nachträglich vergrößert", async () => {
    const user = await createUser({ eventReminderDaysBefore: 1 });
    const event = await createEvent({ date: dayFromStart(4) });

    await expect(processEventReminders()).resolves.toBe(0);

    await prisma.user.update({ where: { id: user.id }, data: { eventReminderDaysBefore: 7 } });
    await expect(processEventReminders()).resolves.toBe(1);

    const dispatch = await prisma.eventReminderDispatch.findUniqueOrThrow({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });
    expect(dispatch.daysBefore).toBe(7);
  });
});

describe("Sofort-Erinnerung beim Bearbeiten eines Termins (PUT /api/admin/events/[id])", () => {
  it("erinnert sofort, wenn ein ausgeblendeter Termin sichtbar geschaltet wird", async () => {
    const user = await createUser({ eventReminderDaysBefore: 3 });
    const event = await createEvent({ date: dayFromStart(2), visibility: "HIDDEN" });

    await expect(processEventReminders()).resolves.toBe(0);

    const response = await putEvent(event.id, { visibility: "MEMBER" });
    expect(response.status).toBe(200);

    await waitForReminder(event.id, user.id);
    expect(await reminderEmailCount(user.email)).toBe(1);
  });

  it("erinnert sofort nach Vorverlegen, erinnert bereits Erinnerte aber nicht erneut", async () => {
    const early = await createUser({ eventReminderDaysBefore: 7 });
    const late = await createUser({ eventReminderDaysBefore: 3 });
    const event = await createEvent({ date: dayFromStart(6) });

    await expect(processEventReminders()).resolves.toBe(1);
    expect(await reminderCount(event.id, early.id)).toBe(1);
    expect(await reminderCount(event.id, late.id)).toBe(0);

    const response = await putEvent(event.id, { date: isoDay(dayFromStart(2)) });
    expect(response.status).toBe(200);

    await waitForReminder(event.id, late.id);
    expect(await reminderCount(event.id, early.id)).toBe(1);
    expect(await reminderEmailCount(early.email)).toBe(1);
    expect(await reminderEmailCount(late.email)).toBe(1);
  });
});

describe("Zurückgezogene Teilnahmeanmeldung", () => {
  async function withdraw(user: Awaited<ReturnType<typeof createUser>>, eventId: string) {
    await prisma.vote.create({ data: { userId: user.id, eventId, vote: "JA" } });
    loginAs(user);
    const response = await deleteVote(apiRequest("DELETE", `/api/events/${eventId}/vote`), routeContext({ id: eventId }));
    expect(response.status).toBe(200);
  }

  it("holt die Erinnerung nicht nach, wenn das Erinnerungsfenster schon offen war, und zeigt sie nicht in der Historie", async () => {
    const user = await createUser({ eventReminderDaysBefore: 7 });
    const event = await createEvent({ date: dayFromStart(3) });

    await withdraw(user, event.id);

    await expect(processEventReminders()).resolves.toBe(0);
    expect(await reminderEmailCount(user.email)).toBe(0);

    loginAs(await createAdmin({ eventReminderEnabled: false }));
    const history = await (await getAdminNotifications(apiRequest("GET", "/api/admin/notifications"))).json();
    expect(history.notifications.filter((n: { event: { id: string } }) => n.event.id === event.id)).toEqual([]);
  });

  it("erinnert regulär, wenn vor Beginn des Erinnerungsfensters zurückgezogen wurde", async () => {
    const user = await createUser({ eventReminderDaysBefore: 3 });
    const day = dayFromStart(10);
    const event = await createEvent({ date: day });

    await withdraw(user, event.id);
    expect(await reminderCount(event.id, user.id)).toBe(0);

    await expect(processEventReminders(new Date(eventStart(day).getTime() - 3 * DAY_MS))).resolves.toBe(1);
    expect(await reminderEmailCount(user.email)).toBe(1);
  });
});

describe("Wartung und Erinnerungs-Vermerke", () => {
  it("behält den Vermerk eines weit verschobenen Termins, sodass nicht ein zweites Mal erinnert wird", async () => {
    const user = await createUser({ eventReminderDaysBefore: 7 });
    const moved = await createEvent({ date: dayFromStart(3) });
    const past = await createEvent({ date: dayFromStart(-120) });
    const longExpired = new Date(START.getTime() - 60 * DAY_MS);
    for (const [eventId, suffix] of [[moved.id, "moved"], [past.id, "past"]]) {
      await prisma.eventReminderDispatch.create({
        data: {
          userId: user.id,
          eventId,
          daysBefore: 7,
          rsvpTokenHash: `rsvp-${suffix}`,
          rsvpTokenExpiresAt: longExpired,
          unsubscribeTokenHash: `unsub-${suffix}`,
          unsubscribeTokenExpiresAt: longExpired,
          queuedAt: new Date(START.getTime() - 120 * DAY_MS),
          sentAt: new Date(START.getTime() - 120 * DAY_MS),
        },
      });
    }

    await runMaintenanceCleanup(START);

    expect(await reminderCount(moved.id, user.id)).toBe(1);
    expect(await reminderCount(past.id, user.id)).toBe(0);
    await expect(processEventReminders()).resolves.toBe(0);
  });
});

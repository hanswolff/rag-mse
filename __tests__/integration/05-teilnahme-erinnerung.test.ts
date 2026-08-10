import type { Event, EventReminderDispatch, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POST as postVote, DELETE as deleteVote } from "@/app/api/events/[id]/vote/route";
import {
  POST as postAdminRegistration,
  DELETE as deleteAdminRegistration,
  GET as getAdminRegistrations,
} from "@/app/api/admin/events/[id]/registrations/route";
import { GET as getEvents } from "@/app/api/events/route";
import { GET as getEvent } from "@/app/api/events/[id]/route";
import { GET as getRsvp, POST as postRsvp } from "@/app/api/notifications/rsvp/[token]/route";
import { processEventReminders } from "@/lib/event-reminder-worker";
import {
  EVENT_REMINDER_EMAIL_TEMPLATE,
  generateNotificationToken,
  getNotificationTokenExpiryDate,
  hashNotificationToken,
} from "@/lib/notifications";
import { parseSensitiveTokens } from "@/lib/email/redact";
import { getRegistrationRange } from "@/lib/registration-count";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createEvent, createUser } from "./helpers/factories";

// ---------------------------------------------------------------------------
// Lokale Hilfsfunktionen (fehlende Factories, nur für diese Datei)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kalendertag in der Zukunft (lokale Zeitzone = Europe/Berlin), 00:00 Uhr. */
function futureEventDay(daysFromNow: number): Date {
  const day = new Date();
  day.setDate(day.getDate() + daysFromNow);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * Zeitpunkt, zu dem der Worker die Erinnerung verschicken soll:
 * Terminbeginn (Datum + timeFrom, Europe/Berlin) minus Vorlaufzeit in Tagen.
 * Der Prozess läuft mit TZ=Europe/Berlin, daher genügt lokale Datumsarithmetik.
 */
function reminderRunTime(eventDay: Date, timeFrom: string, daysBefore: number): Date {
  const [hours, minutes] = timeFrom.split(":").map((value) => Number.parseInt(value, 10));
  const eventStart = new Date(
    eventDay.getFullYear(),
    eventDay.getMonth(),
    eventDay.getDate(),
    hours,
    minutes,
    0,
    0
  );
  return new Date(eventStart.getTime() - daysBefore * DAY_MS);
}

/**
 * Worker-Tests teilen sich die Datei-Datenbank mit den übrigen Tests.
 * Damit früher angelegte Benutzer (eventReminderEnabled default true) keine
 * zusätzlichen Erinnerungen erzeugen, werden sie vorab stummgeschaltet.
 */
async function disableRemindersForExistingUsers(): Promise<void> {
  await prisma.user.updateMany({ data: { eventReminderEnabled: false } });
}

/**
 * Legt einen echten EventReminderDispatch mit echten Token-Hashes an
 * (lib/notifications-Helfer) und liefert den Roh-Token zurück.
 */
async function createReminderDispatch(
  user: User,
  event: Event,
  overrides: { rsvpTokenExpiresAt?: Date } = {}
): Promise<{ dispatch: EventReminderDispatch; rsvpToken: string }> {
  const rsvpToken = generateNotificationToken();
  const unsubscribeToken = generateNotificationToken();
  const expiresAt = overrides.rsvpTokenExpiresAt ?? getNotificationTokenExpiryDate();

  const dispatch = await prisma.eventReminderDispatch.create({
    data: {
      userId: user.id,
      eventId: event.id,
      daysBefore: 7,
      rsvpTokenHash: hashNotificationToken(rsvpToken),
      rsvpTokenExpiresAt: expiresAt,
      unsubscribeTokenHash: hashNotificationToken(unsubscribeToken),
      unsubscribeTokenExpiresAt: expiresAt,
      queuedAt: new Date(),
      sentAt: new Date(),
    },
  });

  return { dispatch, rsvpToken };
}

async function countVotes(eventId: string, userId: string): Promise<number> {
  return prisma.vote.count({ where: { eventId, userId } });
}

// ---------------------------------------------------------------------------
// Teilnahmeanmeldung Mitglied
// ---------------------------------------------------------------------------

describe("Teilnahmeanmeldung Mitglied (POST/DELETE /api/events/[id]/vote)", () => {
  it("speichert Ja, ändert auf Vielleicht und Nein — genau ein Datensatz, Wert ersetzt", async () => {
    const user = await createUser();
    const event = await createEvent();
    loginAs(user);

    for (const vote of ["JA", "VIELLEICHT", "NEIN"]) {
      const response = await postVote(
        apiRequest("POST", `/api/events/${event.id}/vote`, { body: { vote } }),
        routeContext({ id: event.id })
      );
      expect(response.status).toBe(200);
    }

    expect(await countVotes(event.id, user.id)).toBe(1);
    const fromDb = await prisma.vote.findUniqueOrThrow({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });
    expect(fromDb.vote).toBe("NEIN");
  });

  it("zieht die Anmeldung zurück und löscht den Datensatz; erneutes Zurückziehen liefert 404", async () => {
    const user = await createUser();
    const event = await createEvent();
    loginAs(user);

    await postVote(
      apiRequest("POST", `/api/events/${event.id}/vote`, { body: { vote: "JA" } }),
      routeContext({ id: event.id })
    );

    const deleteResponse = await deleteVote(
      apiRequest("DELETE", `/api/events/${event.id}/vote`),
      routeContext({ id: event.id })
    );
    expect(deleteResponse.status).toBe(200);
    expect(await countVotes(event.id, user.id)).toBe(0);

    const secondDelete = await deleteVote(
      apiRequest("DELETE", `/api/events/${event.id}/vote`),
      routeContext({ id: event.id })
    );
    expect(secondDelete.status).toBe(404);
  });

  it("lehnt eine Anmeldung ohne Session mit 401 ab", async () => {
    const event = await createEvent();

    const response = await postVote(
      apiRequest("POST", `/api/events/${event.id}/vote`, { body: { vote: "JA" } }),
      routeContext({ id: event.id })
    );

    expect(response.status).toBe(401);
    expect(await prisma.vote.count({ where: { eventId: event.id } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Teilnahmeanmeldung Gast (Adminbereich)
// ---------------------------------------------------------------------------

describe("Teilnahmeanmeldung Gast (POST/DELETE /api/admin/events/[id]/registrations)", () => {
  it("erfasst einen Gast; zweite Erfassung desselben Namens ersetzt den Wert (genau ein Datensatz)", async () => {
    const admin = await createAdmin();
    const event = await createEvent();
    loginAs(admin);

    const first = await postAdminRegistration(
      apiRequest("POST", `/api/admin/events/${event.id}/registrations`, {
        body: { type: "guest", name: "Gast Müller", vote: "JA" },
      }),
      routeContext({ id: event.id })
    );
    expect(first.status).toBe(200);

    // Die Route ist als Upsert definiert: derselbe Name legt keinen zweiten
    // Datensatz an, sondern ersetzt den Wert (Unique-Constraint eventId+name).
    const second = await postAdminRegistration(
      apiRequest("POST", `/api/admin/events/${event.id}/registrations`, {
        body: { type: "guest", name: "Gast Müller", vote: "VIELLEICHT" },
      }),
      routeContext({ id: event.id })
    );
    expect(second.status).toBe(200);

    const guests = await prisma.guestRegistration.findMany({ where: { eventId: event.id } });
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe("Gast Müller");
    expect(guests[0].vote).toBe("VIELLEICHT");
  });

  it("erzwingt die Einmaligkeitsregel auf DB-Ebene (Unique-Constraint eventId+name)", async () => {
    const event = await createEvent();
    await prisma.guestRegistration.create({
      data: { eventId: event.id, name: "Gast Schröder", vote: "JA" },
    });

    await expect(
      prisma.guestRegistration.create({
        data: { eventId: event.id, name: "Gast Schröder", vote: "NEIN" },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(
      await prisma.guestRegistration.count({ where: { eventId: event.id, name: "Gast Schröder" } })
    ).toBe(1);
  });

  it("löscht eine Gastanmeldung wieder", async () => {
    const admin = await createAdmin();
    const event = await createEvent();
    loginAs(admin);

    await prisma.guestRegistration.create({
      data: { eventId: event.id, name: "Gast Weiß", vote: "JA" },
    });

    const response = await deleteAdminRegistration(
      apiRequest("DELETE", `/api/admin/events/${event.id}/registrations`, {
        body: { type: "guest", name: "Gast Weiß" },
      }),
      routeContext({ id: event.id })
    );

    expect(response.status).toBe(200);
    expect(await prisma.guestRegistration.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("verweigert Mitgliedern ohne Adminrolle die Gasterfassung (403)", async () => {
    const member = await createUser();
    const event = await createEvent();
    loginAs(member);

    const response = await postAdminRegistration(
      apiRequest("POST", `/api/admin/events/${event.id}/registrations`, {
        body: { type: "guest", name: "Gast Unbefugt", vote: "JA" },
      }),
      routeContext({ id: event.id })
    );

    expect(response.status).toBe(403);
    expect(await prisma.guestRegistration.count({ where: { eventId: event.id } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Belegung
// ---------------------------------------------------------------------------

describe("Belegung aus echten Ja-Anmeldungen", () => {
  async function seedMixedRegistrations(event: Event): Promise<void> {
    const [yes1, yes2, maybe] = await Promise.all([createUser(), createUser(), createUser()]);
    await prisma.vote.createMany({
      data: [
        { userId: yes1.id, eventId: event.id, vote: "JA" },
        { userId: yes2.id, eventId: event.id, vote: "JA" },
        { userId: maybe.id, eventId: event.id, vote: "VIELLEICHT" },
      ],
    });
    await prisma.guestRegistration.createMany({
      data: [
        { eventId: event.id, name: "Gast Ja", vote: "JA" },
        { eventId: event.id, name: "Gast Nein", vote: "NEIN" },
      ],
    });
  }

  it("zählt Mitglieder und Gäste gleichermaßen; „Vielleicht“ belegt keinen Platz", async () => {
    const event = await createEvent({ capacity: 5 });
    await seedMixedRegistrations(event);

    const viewer = await createUser();
    loginAs(viewer);

    const response = await getEvent(
      apiRequest("GET", `/api/events/${event.id}`),
      routeContext({ id: event.id })
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    // 2 Mitglieder JA + 1 Gast JA = 3; „Vielleicht“ zählt separat.
    expect(body.voteCounts).toEqual({ JA: 3, NEIN: 1, VIELLEICHT: 1 });

    const range = getRegistrationRange(body.voteCounts);
    expect(range.min).toBe(3); // belegte Plätze
    expect(range.max).toBe(4); // inkl. „Vielleicht“
  });

  it("liefert über die öffentliche Termin-API keine Anmeldedaten oder Belegung aus", async () => {
    const event = await createEvent({ capacity: 5 });
    await seedMixedRegistrations(event);
    logout();

    const detailResponse = await getEvent(
      apiRequest("GET", `/api/events/${event.id}`),
      routeContext({ id: event.id })
    );
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail).not.toHaveProperty("voteCounts");
    expect(detail).not.toHaveProperty("votes");
    expect(detail).not.toHaveProperty("guestRegistrations");
    expect(detail).not.toHaveProperty("currentUserVote");

    const listResponse = await getEvents(apiRequest("GET", "/api/events?limit=50"));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    const listed = list.events.find((entry: { id: string }) => entry.id === event.id);
    expect(listed).toBeDefined();
    expect(listed).not.toHaveProperty("voteCounts");
    expect(listed).not.toHaveProperty("votes");
    expect(listed).not.toHaveProperty("guestRegistrations");
    expect(listed).not.toHaveProperty("_count");
  });

  it("lässt Anmeldungen über die Platzzahl hinaus zu (ADR 0003: Plätze sperren nichts)", async () => {
    const event = await createEvent({ capacity: 1 });
    const [first, second] = await Promise.all([createUser(), createUser()]);

    for (const user of [first, second]) {
      loginAs(user);
      const response = await postVote(
        apiRequest("POST", `/api/events/${event.id}/vote`, { body: { vote: "JA" } }),
        routeContext({ id: event.id })
      );
      expect(response.status).toBe(200);
    }

    expect(await prisma.vote.count({ where: { eventId: event.id, vote: "JA" } })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Termin-Erinnerungs-Worker
// ---------------------------------------------------------------------------

describe("Termin-Erinnerungs-Worker (processEventReminders)", () => {
  it("verschickt genau eine Erinnerung pro Benutzer und Termin; zweiter Lauf dedupliziert real", async () => {
    await disableRemindersForExistingUsers();
    const user = await createUser({ eventReminderDaysBefore: 7 });
    const eventDay = futureEventDay(9);
    const event = await createEvent({ date: eventDay, timeFrom: "10:00" });
    const runAt = reminderRunTime(eventDay, "10:00", 7);

    const firstRun = await processEventReminders(runAt);
    expect(firstRun).toBe(1);

    const dispatches = await prisma.eventReminderDispatch.findMany({
      where: { eventId: event.id },
    });
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].userId).toBe(user.id);
    expect(dispatches[0].sentAt).not.toBeNull();

    const emails = await prisma.outgoingEmail.findMany({
      where: { template: EVENT_REMINDER_EMAIL_TEMPLATE, toRecipients: user.email },
    });
    expect(emails).toHaveLength(1);
    // Der Roh-Token steht nicht im gespeicherten Text (Platzhalter), sondern
    // separat in sensitiveTokensJson — daher der Abgleich über den Hash.
    expect(emails[0].textBody).toContain("/anmeldung/***TOKEN_");
    const tokens = parseSensitiveTokens(emails[0].sensitiveTokensJson);
    expect(
      tokens.some((token) => hashNotificationToken(token) === dispatches[0].rsvpTokenHash)
    ).toBe(true);

    // Zweiter Lauf zum selben Zeitpunkt: Dedup über EventReminderDispatch.
    const secondRun = await processEventReminders(runAt);
    expect(secondRun).toBe(0);
    expect(await prisma.eventReminderDispatch.count({ where: { eventId: event.id } })).toBe(1);
    expect(
      await prisma.outgoingEmail.count({
        where: { template: EVENT_REMINDER_EMAIL_TEMPLATE, toRecipients: user.email },
      })
    ).toBe(1);
  });

  it("respektiert die Vorlaufzeit je Benutzer (eventReminderDaysBefore)", async () => {
    await disableRemindersForExistingUsers();
    const early = await createUser({ eventReminderDaysBefore: 7 });
    const late = await createUser({ eventReminderDaysBefore: 3 });
    const eventDay = futureEventDay(11);
    const event = await createEvent({ date: eventDay, timeFrom: "10:00" });

    // Lauf 7 Tage vorher: nur der Benutzer mit 7 Tagen Vorlauf wird erinnert.
    await processEventReminders(reminderRunTime(eventDay, "10:00", 7));
    expect(
      await prisma.eventReminderDispatch.count({ where: { eventId: event.id, userId: early.id } })
    ).toBe(1);
    expect(
      await prisma.eventReminderDispatch.count({ where: { eventId: event.id, userId: late.id } })
    ).toBe(0);

    // Lauf 3 Tage vorher: jetzt folgt der zweite Benutzer, der erste bleibt bei einer.
    await processEventReminders(reminderRunTime(eventDay, "10:00", 3));
    expect(
      await prisma.eventReminderDispatch.count({ where: { eventId: event.id, userId: late.id } })
    ).toBe(1);
    expect(
      await prisma.eventReminderDispatch.count({ where: { eventId: event.id, userId: early.id } })
    ).toBe(1);
  });

  it("erinnert niemanden, der bereits abgestimmt hat", async () => {
    await disableRemindersForExistingUsers();
    const voted = await createUser({ eventReminderDaysBefore: 7 });
    const silent = await createUser({ eventReminderDaysBefore: 7 });
    const eventDay = futureEventDay(12);
    const event = await createEvent({ date: eventDay, timeFrom: "10:00" });
    await prisma.vote.create({
      data: { userId: voted.id, eventId: event.id, vote: "NEIN" },
    });

    const queued = await processEventReminders(reminderRunTime(eventDay, "10:00", 7));

    expect(queued).toBe(1);
    expect(
      await prisma.eventReminderDispatch.count({ where: { eventId: event.id, userId: voted.id } })
    ).toBe(0);
    expect(
      await prisma.eventReminderDispatch.count({ where: { eventId: event.id, userId: silent.id } })
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RSVP-Token-Link ohne Login
// ---------------------------------------------------------------------------

describe("RSVP-Token-Link ohne Login (/api/notifications/rsvp/[token])", () => {
  it("kompletter Fluss: Worker-Mail → Roh-Token → Anmeldung ohne Session schreibt den richtigen Datensatz", async () => {
    await disableRemindersForExistingUsers();
    const user = await createUser({ eventReminderDaysBefore: 7 });
    const eventDay = futureEventDay(13);
    const event = await createEvent({ date: eventDay, timeFrom: "10:00" });

    await processEventReminders(reminderRunTime(eventDay, "10:00", 7));

    const dispatch = await prisma.eventReminderDispatch.findUniqueOrThrow({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });
    const email = await prisma.outgoingEmail.findFirstOrThrow({
      where: { template: EVENT_REMINDER_EMAIL_TEMPLATE, toRecipients: user.email },
    });
    const rsvpToken = parseSensitiveTokens(email.sensitiveTokensJson).find(
      (token) => hashNotificationToken(token) === dispatch.rsvpTokenHash
    );
    expect(rsvpToken).toBeDefined();

    logout();

    const getResponse = await getRsvp(
      apiRequest("GET", `/api/notifications/rsvp/${rsvpToken}`),
      routeContext({ token: rsvpToken as string })
    );
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.event.id).toBe(event.id);
    expect(getBody.currentVote).toBeNull();

    const postResponse = await postRsvp(
      apiRequest("POST", `/api/notifications/rsvp/${rsvpToken}`, { body: { vote: "JA" } }),
      routeContext({ token: rsvpToken as string })
    );
    expect(postResponse.status).toBe(200);

    const votes = await prisma.vote.findMany({ where: { eventId: event.id } });
    expect(votes).toHaveLength(1);
    expect(votes[0].userId).toBe(user.id);
    expect(votes[0].vote).toBe("JA");
  });

  it("lehnt einen fremden (unbekannten) Token mit 404 ab", async () => {
    logout();
    const foreignToken = generateNotificationToken();

    const getResponse = await getRsvp(
      apiRequest("GET", `/api/notifications/rsvp/${foreignToken}`),
      routeContext({ token: foreignToken })
    );
    expect(getResponse.status).toBe(404);

    const postResponse = await postRsvp(
      apiRequest("POST", `/api/notifications/rsvp/${foreignToken}`, { body: { vote: "JA" } }),
      routeContext({ token: foreignToken })
    );
    expect(postResponse.status).toBe(404);
  });

  it("lehnt einen abgelaufenen Token mit 410 ab und schreibt keinen Vote", async () => {
    const user = await createUser();
    const event = await createEvent();
    const { rsvpToken } = await createReminderDispatch(user, event, {
      rsvpTokenExpiresAt: new Date(Date.now() - 60 * 1000),
    });
    logout();

    const response = await postRsvp(
      apiRequest("POST", `/api/notifications/rsvp/${rsvpToken}`, { body: { vote: "JA" } }),
      routeContext({ token: rsvpToken })
    );

    expect(response.status).toBe(410);
    expect(await countVotes(event.id, user.id)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sichtbarkeit
// ---------------------------------------------------------------------------

describe("Sichtbarkeit ausgeblendeter Termine (visible = false)", () => {
  it("fehlt in der öffentlichen API (Liste und Detail)", async () => {
    const hidden = await createEvent({ visible: false });
    logout();

    const listResponse = await getEvents(apiRequest("GET", "/api/events?limit=50"));
    const list = await listResponse.json();
    const allListed = [...list.events, ...list.pastEvents];
    expect(allListed.find((entry: { id: string }) => entry.id === hidden.id)).toBeUndefined();

    const detailResponse = await getEvent(
      apiRequest("GET", `/api/events/${hidden.id}`),
      routeContext({ id: hidden.id })
    );
    expect(detailResponse.status).toBe(404);
  });

  it("bleibt für eingeloggte Mitglieder unsichtbar (Liste, Detail, Vote)", async () => {
    const hidden = await createEvent({ visible: false });
    const member = await createUser();
    loginAs(member);

    const listResponse = await getEvents(apiRequest("GET", "/api/events?limit=50"));
    const list = await listResponse.json();
    const allListed = [...list.events, ...list.pastEvents];
    expect(allListed.find((entry: { id: string }) => entry.id === hidden.id)).toBeUndefined();

    const detailResponse = await getEvent(
      apiRequest("GET", `/api/events/${hidden.id}`),
      routeContext({ id: hidden.id })
    );
    expect(detailResponse.status).toBe(404);

    const voteResponse = await postVote(
      apiRequest("POST", `/api/events/${hidden.id}/vote`, { body: { vote: "JA" } }),
      routeContext({ id: hidden.id })
    );
    expect(voteResponse.status).toBe(404);
    expect(await prisma.vote.count({ where: { eventId: hidden.id } })).toBe(0);
  });

  it("bleibt im Adminbereich sichtbar (Anmeldungen abrufbar)", async () => {
    const hidden = await createEvent({ visible: false });
    await prisma.guestRegistration.create({
      data: { eventId: hidden.id, name: "Gast Ausgeblendet", vote: "JA" },
    });
    const admin = await createAdmin();
    loginAs(admin);

    const response = await getAdminRegistrations(
      apiRequest("GET", `/api/admin/events/${hidden.id}/registrations`),
      routeContext({ id: hidden.id })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.guests).toHaveLength(1);
    expect(body.guests[0].name).toBe("Gast Ausgeblendet");
  });
});

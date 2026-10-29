import path from "path";
import Database from "better-sqlite3";
import type { Event, User, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getEvents } from "@/app/api/events/route";
import { GET as getEvent } from "@/app/api/events/[id]/route";
import { POST as postVote } from "@/app/api/events/[id]/vote/route";
import { GET as getPolls } from "@/app/api/polls/route";
import { GET as getPoll } from "@/app/api/polls/[id]/route";
import { POST as postAdminEvent } from "@/app/api/admin/events/route";
import { PUT as putAdminEvent } from "@/app/api/admin/events/[id]/route";
import { GET as getRsvp, POST as postRsvp } from "@/app/api/notifications/rsvp/[token]/route";
import * as reminderWorker from "@/lib/reminders/event-reminder-worker";
import {
  generateNotificationToken,
  getNotificationTokenExpiryDate,
  hashNotificationToken,
} from "@/lib/reminders/notifications";
import { runMigrations } from "../../scripts/run-db-migrations";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createAuditor, createEvent, createPoll, createUser } from "./helpers/factories";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVELS: Visibility[] = ["PUBLIC", "MEMBER", "HIDDEN"];

type Role = "anonym" | "Mitglied" | "Prüfer" | "Administrator";

const EXPECTED_DETAIL_STATUS: Record<Role, Record<Visibility, number>> = {
  anonym: { PUBLIC: 200, MEMBER: 401, HIDDEN: 404 },
  Mitglied: { PUBLIC: 200, MEMBER: 200, HIDDEN: 404 },
  Prüfer: { PUBLIC: 200, MEMBER: 200, HIDDEN: 200 },
  Administrator: { PUBLIC: 200, MEMBER: 200, HIDDEN: 200 },
};

let events: Record<Visibility, Event>;
let viewers: Record<Exclude<Role, "anonym">, User>;

function actAs(role: Role): void {
  if (role === "anonym") {
    logout();
  } else {
    loginAs(viewers[role]);
  }
}

async function listedIds(): Promise<string[]> {
  const response = await getEvents(apiRequest("GET", "/api/events?limit=50"));
  const body = await response.json();
  return [...body.events, ...body.pastEvents].map((entry: { id: string }) => entry.id);
}

function fetchDetail(event: Event) {
  return getEvent(apiRequest("GET", `/api/events/${event.id}`), routeContext({ id: event.id }));
}

function vote(event: Event) {
  return postVote(
    apiRequest("POST", `/api/events/${event.id}/vote`, { body: { vote: "JA" } }),
    routeContext({ id: event.id })
  );
}

async function createRsvpToken(user: User, event: Event): Promise<string> {
  const token = generateNotificationToken();
  const expiresAt = getNotificationTokenExpiryDate();
  await prisma.eventReminderDispatch.create({
    data: {
      userId: user.id,
      eventId: event.id,
      daysBefore: 7,
      rsvpTokenHash: hashNotificationToken(token),
      rsvpTokenExpiresAt: expiresAt,
      unsubscribeTokenHash: hashNotificationToken(generateNotificationToken()),
      unsubscribeTokenExpiresAt: expiresAt,
      queuedAt: new Date(),
      sentAt: new Date(),
    },
  });
  return token;
}

function inDays(days: number): string {
  const date = new Date(Date.now() + days * DAY_MS);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Die Sofort-Erinnerung läuft fire-and-forget; der Spy reicht die echte
// Implementierung durch und hält ihre Promises fest, damit der Test auf das
// Ergebnis warten kann.
async function settleImmediateReminders(spy: jest.SpyInstance): Promise<void> {
  await Promise.all(spy.mock.results.map((result) => result.value));
}

async function reminderRecipients(eventId: string): Promise<string[]> {
  const dispatches = await prisma.eventReminderDispatch.findMany({ where: { eventId } });
  return dispatches.map((dispatch) => dispatch.userId);
}

beforeAll(async () => {
  await prisma.user.updateMany({ data: { eventReminderEnabled: false } });
  const [PUBLIC, MEMBER, HIDDEN] = await Promise.all(
    LEVELS.map((visibility) => createEvent({ visibility, title: `Sichtbarkeit ${visibility}` }))
  );
  events = { PUBLIC, MEMBER, HIDDEN };
  viewers = {
    Mitglied: await createUser({ eventReminderEnabled: false }),
    Prüfer: await createAuditor({ eventReminderEnabled: false }),
    Administrator: await createAdmin({ eventReminderEnabled: false }),
  };
});

describe.each<Role>(["anonym", "Mitglied", "Prüfer", "Administrator"])("Sichtbarkeitsstufe für %s", (role) => {
  it("Liste enthält genau die erlaubten Stufen", async () => {
    actAs(role);
    const ids = await listedIds();

    for (const level of LEVELS) {
      expect(ids.includes(events[level].id)).toBe(EXPECTED_DETAIL_STATUS[role][level] === 200);
    }
  });

  it.each(LEVELS)("Detail eines %s-Termins", async (level) => {
    actAs(role);
    const response = await fetchDetail(events[level]);
    const expected = EXPECTED_DETAIL_STATUS[role][level];

    expect(response.status).toBe(expected);
    const body = await response.json();
    if (expected === 200) {
      expect(body.id).toBe(events[level].id);
    } else {
      expect(body).not.toHaveProperty("title");
      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    }
  });
});

describe("Teilnahmeanmeldung je Sichtbarkeitsstufe", () => {
  it.each<[Visibility, number]>([
    ["PUBLIC", 200],
    ["MEMBER", 200],
    ["HIDDEN", 404],
  ])("Mitglied meldet sich bei %s an → %i", async (level, status) => {
    const member = await createUser();
    loginAs(member);

    const response = await vote(events[level]);

    expect(response.status).toBe(status);
    expect(await prisma.vote.count({ where: { eventId: events[level].id, userId: member.id } })).toBe(
      status === 200 ? 1 : 0
    );
  });

  it("Administrator darf sich auch bei verborgenen Terminen anmelden", async () => {
    actAs("Administrator");
    expect((await vote(events.HIDDEN)).status).toBe(200);
  });

  it("anonym wird nicht angemeldet, auch nicht bei Mitglieder-Terminen", async () => {
    logout();
    const response = await vote(events.MEMBER);
    expect(response.status).toBe(401);
  });
});

describe("RSVP-Link aus der Erinnerung", () => {
  it.each<[Visibility, number]>([
    ["PUBLIC", 200],
    ["MEMBER", 200],
    ["HIDDEN", 404],
  ])("%s-Termin → %i für GET und POST", async (level, status) => {
    const member = await createUser();
    const token = await createRsvpToken(member, events[level]);
    logout();

    const read = await getRsvp(
      apiRequest("GET", `/api/notifications/rsvp/${token}`),
      routeContext({ token })
    );
    const write = await postRsvp(
      apiRequest("POST", `/api/notifications/rsvp/${token}`, { body: { vote: "JA" } }),
      routeContext({ token })
    );

    expect(read.status).toBe(status);
    expect(write.status).toBe(status);
    expect(await prisma.vote.count({ where: { eventId: events[level].id, userId: member.id } })).toBe(
      status === 200 ? 1 : 0
    );
  });
});

describe("Umfrage mit gebundenem Termin", () => {
  async function pollBoundTo(event: Event) {
    const poll = await createPoll({ status: "LIVE" });
    await prisma.poll.update({ where: { id: poll.id }, data: { type: "TERMIN", eventId: event.id } });
    return poll.id;
  }

  async function boundEvent(pollId: string) {
    const detail = await (await getPoll(apiRequest("GET", `/api/polls/${pollId}`), routeContext({ id: pollId }))).json();
    const list = await (await getPolls(apiRequest("GET", "/api/polls?limit=50"))).json();
    const listed = list.polls.find((entry: { id: string }) => entry.id === pollId);
    return { detail: detail.event, listed: listed.event };
  }

  it("verschweigt Mitgliedern einen verborgenen Termin", async () => {
    const pollId = await pollBoundTo(events.HIDDEN);
    actAs("Mitglied");

    expect(await boundEvent(pollId)).toEqual({ detail: null, listed: null });
  });

  it("zeigt Mitgliedern einen Mitglieder-Termin ohne interne Felder", async () => {
    const pollId = await pollBoundTo(events.MEMBER);
    actAs("Mitglied");

    const { detail, listed } = await boundEvent(pollId);
    expect(detail.id).toBe(events.MEMBER.id);
    expect(listed.id).toBe(events.MEMBER.id);
    expect(detail).not.toHaveProperty("createdById");
  });

  it.each<Role>(["Administrator", "Prüfer"])("zeigt %s den verborgenen Termin", async (role) => {
    const pollId = await pollBoundTo(events.HIDDEN);
    actAs(role);

    const { detail, listed } = await boundEvent(pollId);
    expect(detail.location).toBe(events.HIDDEN.location);
    expect(listed.id).toBe(events.HIDDEN.id);
  });
});

describe("Eigener verborgener Termin", () => {
  it("bleibt für den Ersteller sichtbar, für andere Mitglieder nicht", async () => {
    const creator = await createUser();
    const own = await createEvent({ visibility: "HIDDEN", createdById: creator.id });

    loginAs(creator);
    expect(await listedIds()).toContain(own.id);
    expect((await fetchDetail(own)).status).toBe(200);
    expect((await vote(own)).status).toBe(200);

    actAs("Mitglied");
    expect(await listedIds()).not.toContain(own.id);
    expect((await fetchDetail(own)).status).toBe(404);
  });
});

describe("Sofort-Erinnerung", () => {
  let spy: jest.SpyInstance;
  let recipient: User;

  beforeEach(async () => {
    await prisma.user.updateMany({ data: { eventReminderEnabled: false } });
    recipient = await createUser({ eventReminderEnabled: true, eventReminderDaysBefore: 7 });
    spy = jest.spyOn(reminderWorker, "triggerImmediateEventReminders");
  });

  afterEach(() => {
    spy.mockRestore();
  });

  async function createViaAdmin(visibility: Visibility): Promise<string> {
    actAs("Administrator");
    const response = await postAdminEvent(
      apiRequest("POST", "/api/admin/events", {
        body: {
          date: inDays(3),
          timeFrom: "10:00",
          timeTo: "12:00",
          location: "Schießstand Sofort",
          description: "<p>Sofort-Erinnerung</p>",
          visibility,
        },
      })
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.visibility).toBe(visibility);
    return body.id;
  }

  it.each<[Visibility, boolean]>([
    ["PUBLIC", true],
    ["MEMBER", true],
    ["HIDDEN", false],
  ])("beim Anlegen eines %s-Termins: Erinnerung %p", async (visibility, expected) => {
    const eventId = await createViaAdmin(visibility);
    await settleImmediateReminders(spy);

    expect((await reminderRecipients(eventId)).includes(recipient.id)).toBe(expected);
  });

  it.each<Visibility>(["PUBLIC", "MEMBER"])(
    "beim Wechsel von HIDDEN auf %s",
    async (visibility) => {
      const eventId = await createViaAdmin("HIDDEN");
      await settleImmediateReminders(spy);
      expect(await reminderRecipients(eventId)).toEqual([]);

      const response = await putAdminEvent(
        apiRequest("PUT", `/api/admin/events/${eventId}`, { body: { visibility } }),
        routeContext({ id: eventId })
      );
      expect(response.status).toBe(200);
      await settleImmediateReminders(spy);

      expect(await reminderRecipients(eventId)).toContain(recipient.id);
    }
  );

  it("weist eine unbekannte Stufe mit den erlaubten Codes ab", async () => {
    actAs("Administrator");
    const response = await putAdminEvent(
      apiRequest("PUT", `/api/admin/events/${events.PUBLIC.id}`, { body: { visibility: "MEMBERS" } }),
      routeContext({ id: events.PUBLIC.id })
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(
      "Sichtbarkeitsstufe muss Öffentlich (PUBLIC), Nur für Mitglieder (MEMBER) oder Verborgen (HIDDEN) sein"
    );
  });

  describe("veraltetes Formular mit `visible`", () => {
    const baseBody = {
      date: inDays(3),
      timeFrom: "10:00",
      timeTo: "12:00",
      location: "Schießstand Altbestand",
      description: "<p>Altes Bundle</p>",
    };

    async function countAltbestand(): Promise<number> {
      return prisma.event.count({ where: { location: "Schießstand Altbestand" } });
    }

    it("lehnt POST mit visible:false ab – kein Termin, keine Erinnerung", async () => {
      actAs("Administrator");
      const response = await postAdminEvent(
        apiRequest("POST", "/api/admin/events", { body: { ...baseBody, visible: false } })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Bitte Seite neu laden");
      expect(await countAltbestand()).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    });

    it("lehnt POST ohne Sichtbarkeitsstufe ab", async () => {
      actAs("Administrator");
      const response = await postAdminEvent(apiRequest("POST", "/api/admin/events", { body: baseBody }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Sichtbarkeitsstufe ist erforderlich");
      expect(await countAltbestand()).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    });

    it("lehnt PUT mit visible ab und lässt den Termin unverändert", async () => {
      actAs("Administrator");
      const response = await putAdminEvent(
        apiRequest("PUT", `/api/admin/events/${events.HIDDEN.id}`, { body: { visible: true, location: "Neu" } }),
        routeContext({ id: events.HIDDEN.id })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Bitte Seite neu laden");
      const unchanged = await prisma.event.findUniqueOrThrow({ where: { id: events.HIDDEN.id } });
      expect(unchanged.visibility).toBe("HIDDEN");
      expect(unchanged.location).toBe(events.HIDDEN.location);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("verschickt periodische Erinnerungen für MEMBER, nicht für HIDDEN", async () => {
    const day = new Date();
    day.setDate(day.getDate() + 9);
    day.setHours(0, 0, 0, 0);
    const member = await createEvent({ date: day, timeFrom: "10:00", visibility: "MEMBER" });
    const hidden = await createEvent({ date: day, timeFrom: "10:00", visibility: "HIDDEN" });
    const runAt = new Date(day.getTime() + 10 * 60 * 60 * 1000 - 7 * DAY_MS);

    await reminderWorker.processEventReminders(runAt);

    expect(await reminderRecipients(member.id)).toEqual([recipient.id]);
    expect(await reminderRecipients(hidden.id)).toEqual([]);
  });
});

describe("Migration 20261019_event_visibility", () => {
  function migrateLegacyEvents(fileName: string) {
    const dbPath = path.join(process.env.RAG_MSE_INTEGRATION_TMP_DIR as string, fileName);
    const url = `file:${dbPath}`;
    runMigrations(url, { quiet: true });

    const db = new Database(dbPath);
    db.exec(`
      DELETE FROM "_AppMigration" WHERE "name" = '20261019_event_visibility';
      DROP TRIGGER "Event_visible_sync_insert";
      DROP TRIGGER "Event_visible_sync_update";
      ALTER TABLE "Event" DROP COLUMN "visibility";
      INSERT INTO "Event" ("id", "date", "timeFrom", "timeTo", "location", "description", "visible", "updatedAt")
      VALUES ('sichtbar', 0, '10:00', '12:00', 'Ort', 'Beschreibung', 1, 0),
             ('ausgeblendet', 0, '10:00', '12:00', 'Ort', 'Beschreibung', 0, 0);
    `);
    db.close();

    runMigrations(url, { quiet: true });
    return dbPath;
  }

  it("überführt visible=0 in HIDDEN und visible=1 in PUBLIC und behält die Spalte für Rollbacks", () => {
    const migrated = new Database(migrateLegacyEvents("backfill.db"), { readonly: true });
    const rows = migrated.prepare('SELECT "id", "visibility", "visible" FROM "Event" ORDER BY "id"').all();
    migrated.close();

    expect(rows).toEqual([
      { id: "ausgeblendet", visibility: "HIDDEN", visible: 0 },
      { id: "sichtbar", visibility: "PUBLIC", visible: 1 },
    ]);
  });

  it("hält visible synchron, sodass ein altes Image nur öffentliche Termine als sichtbar sieht", () => {
    const db = new Database(migrateLegacyEvents("trigger.db"));
    db.exec(`
      UPDATE "Event" SET "visibility" = 'MEMBER' WHERE "id" = 'sichtbar';
      UPDATE "Event" SET "visibility" = 'PUBLIC' WHERE "id" = 'ausgeblendet';
      INSERT INTO "Event" ("id", "date", "timeFrom", "timeTo", "location", "description", "visibility", "updatedAt")
      VALUES ('neu-verborgen', 0, '10:00', '12:00', 'Ort', 'Beschreibung', 'HIDDEN', 0),
             ('neu-oeffentlich', 0, '10:00', '12:00', 'Ort', 'Beschreibung', 'PUBLIC', 0);
      INSERT INTO "Event" ("id", "date", "timeFrom", "timeTo", "location", "description", "visible", "updatedAt")
      VALUES ('altes-image-ausgeblendet', 0, '10:00', '12:00', 'Ort', 'Beschreibung', 0, 0);
    `);
    const rows = db.prepare('SELECT "id", "visible" FROM "Event" ORDER BY "id"').all();
    db.close();

    expect(rows).toEqual([
      { id: "altes-image-ausgeblendet", visible: 0 },
      { id: "ausgeblendet", visible: 1 },
      { id: "neu-oeffentlich", visible: 1 },
      { id: "neu-verborgen", visible: 0 },
      { id: "sichtbar", visible: 0 },
    ]);
  });
});

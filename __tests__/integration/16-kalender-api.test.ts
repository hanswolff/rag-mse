import type { Ausschreibung, Event, ExternalEvent, User, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getCalendar } from "@/app/api/kalender/route";
import { apiRequest } from "./helpers/api";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createAuditor, createEvent, createUser } from "./helpers/factories";

const NOW = new Date("2026-10-19T12:00:00+02:00");
const NOVEMBER = "von=2026-11-01&bis=2026-11-30";
const LEVELS: Visibility[] = ["PUBLIC", "MEMBER", "HIDDEN"];

type Role = "anonym" | "Mitglied" | "Prüfer" | "Administrator";

const VISIBLE_LEVELS: Record<Role, Visibility[]> = {
  anonym: ["PUBLIC"],
  Mitglied: ["PUBLIC", "MEMBER"],
  Prüfer: LEVELS,
  Administrator: LEVELS,
};

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
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
});

afterEach(() => {
  jest.useRealTimers();
});

function localDate(isoDate: string, hours = 0): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, hours);
}

let viewers: Record<Exclude<Role, "anonym">, User>;
let otherMember: User;
let termine: Record<Visibility, Event>;
let fremdtermine: Record<Visibility, ExternalEvent>;
let ausschreibungen: Record<Visibility, Ausschreibung>;

function actAs(role: Role): void {
  if (role === "anonym") {
    logout();
  } else {
    loginAs(viewers[role]);
  }
}

async function fetchCalendar(query = NOVEMBER) {
  return getCalendar(apiRequest("GET", `/api/kalender?${query}`));
}

async function fetchBody(query = NOVEMBER) {
  const response = await fetchCalendar(query);
  expect(response.status).toBe(200);
  return response.json();
}

function ids(entries: { id: string }[]): string[] {
  return entries.map((entry) => entry.id);
}

function createExternalEvent(title: string, startDate: string, endDate: string, extra: Partial<ExternalEvent> = {}) {
  return prisma.externalEvent.create({
    data: { title, startDate: localDate(startDate), endDate: localDate(endDate), visibility: "PUBLIC", ...extra },
  });
}

let seq = 0;
function createAusschreibung(visibility: Visibility) {
  seq += 1;
  return prisma.ausschreibung.create({
    data: {
      title: `Ausschreibung ${visibility}`,
      expiresAt: new Date("2026-12-31T00:00:00Z"),
      originalFileName: `a-${seq}.pdf`,
      storedFileName: `kalender-${seq}-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      visibility,
    },
  });
}

beforeAll(async () => {
  viewers = {
    Mitglied: await createUser({ name: "Max Muster" }),
    Prüfer: await createAuditor({ name: "Paul Prüfer" }),
    Administrator: await createAdmin({ name: "Anna Admin" }),
  };
  otherMember = await createUser({ name: "Erika Beispiel" });

  const entries = await Promise.all(
    LEVELS.map(async (visibility) => {
      const ausschreibung = await createAusschreibung(visibility);
      const termin = await createEvent({
        date: localDate("2026-11-10", 18),
        timeFrom: "18:00",
        timeTo: "20:00",
        title: `Termin ${visibility}`,
        type: "Training",
        visibility,
      });
      const fremdtermin = await createExternalEvent(`Fremdtermin ${visibility}`, "2026-11-14", "2026-11-15", {
        visibility,
        kind: "RDL",
        url: "https://example.com/rdl",
        location: "Kaserne",
      });
      return { visibility, ausschreibung, termin, fremdtermin };
    })
  );
  termine = Object.fromEntries(entries.map((entry) => [entry.visibility, entry.termin])) as typeof termine;
  fremdtermine = Object.fromEntries(entries.map((entry) => [entry.visibility, entry.fremdtermin])) as typeof fremdtermine;
  ausschreibungen = Object.fromEntries(entries.map((entry) => [entry.visibility, entry.ausschreibung])) as typeof ausschreibungen;

  await createEvent({ date: localDate("2026-12-01", 10), title: "Dezember", visibility: "PUBLIC" });
  await createEvent({ date: localDate("2026-10-31", 10), title: "Oktober", visibility: "PUBLIC" });

  await prisma.absence.createMany({
    data: [
      {
        userId: viewers.Mitglied.id,
        createdById: viewers.Administrator.id,
        startDate: localDate("2026-11-03"),
        endDate: localDate("2026-11-04"),
        reason: "Urlaub",
      },
      {
        userId: otherMember.id,
        createdById: otherMember.id,
        startDate: localDate("2026-11-03"),
        endDate: localDate("2026-11-03"),
        reason: "Schicht",
      },
      {
        userId: viewers.Administrator.id,
        createdById: viewers.Administrator.id,
        startDate: localDate("2026-11-20"),
        endDate: localDate("2026-11-20"),
        allDay: false,
        timeFrom: "08:00",
        timeTo: "12:00",
      },
    ],
  });
});

describe("GET /api/kalender – Sichtbarkeit je Rolle", () => {
  it.each(Object.keys(VISIBLE_LEVELS) as Role[])("%s sieht Termine und Fremdtermine seiner Sichtbarkeitsstufen", async (role) => {
    actAs(role);
    const body = await fetchBody();
    const expected = VISIBLE_LEVELS[role];

    expect(ids(body.termine).sort()).toEqual(expected.map((level) => termine[level].id).sort());
    expect(ids(body.fremdtermine).sort()).toEqual(expected.map((level) => fremdtermine[level].id).sort());
  });

  it("liefert Termine ohne Anmeldedaten, Sichtbarkeitsstufe nur für Eingeloggte", async () => {
    logout();
    const anonymous = await fetchBody();
    expect(anonymous.termine[0]).toEqual({
      id: termine.PUBLIC.id,
      date: "2026-11-10",
      timeFrom: "18:00",
      timeTo: "20:00",
      title: "Termin PUBLIC",
      type: "Training",
      location: termine.PUBLIC.location,
    });
    expect(anonymous.fremdtermine[0]).not.toHaveProperty("visibility");

    actAs("Mitglied");
    const member = await fetchBody();
    const memberTermin = member.termine.find((entry: { id: string }) => entry.id === termine.MEMBER.id);
    expect(memberTermin).toMatchObject({ visibility: "MEMBER" });
    expect(memberTermin).not.toHaveProperty("voteCounts");
    expect(memberTermin).not.toHaveProperty("votes");
    expect(member.fremdtermine.find((entry: { id: string }) => entry.id === fremdtermine.MEMBER.id)).toMatchObject({
      title: "Fremdtermin MEMBER",
      startDate: "2026-11-14",
      endDate: "2026-11-15",
      allDay: true,
      kind: "RDL",
      url: "https://example.com/rdl",
      location: "Kaserne",
      visibility: "MEMBER",
    });
  });
});

describe("GET /api/kalender – Abwesenheiten", () => {
  it("anonyme Besucher erhalten keine Abwesenheiten", async () => {
    logout();
    expect((await fetchBody()).abwesenheiten).toEqual([]);
  });

  it("ein Mitglied erhält nur die eigenen Abwesenheiten, nie fremde", async () => {
    actAs("Mitglied");
    const { abwesenheiten } = await fetchBody();
    expect(abwesenheiten).toHaveLength(1);
    expect(abwesenheiten[0]).toMatchObject({
      reason: "Urlaub",
      isOwn: true,
      startDate: "2026-11-03",
      endDate: "2026-11-04",
      userId: viewers.Mitglied.id,
      enteredBy: { kind: "other", name: "Anna Admin" },
    });
    expect(JSON.stringify(abwesenheiten)).not.toContain("Schicht");
    expect(JSON.stringify(abwesenheiten)).not.toContain("@example.com");
  });

  it.each(["Administrator", "Prüfer"] as const)("%s erhält alle Abwesenheiten mit Namen, Eigentümer-ID und Eintragendem, aber ohne E-Mail", async (role) => {
    actAs(role);
    const { abwesenheiten } = await fetchBody();
    expect(abwesenheiten.map((absence: { userName: string }) => absence.userName).sort()).toEqual(
      ["Anna Admin", "Erika Beispiel", "Max Muster"]
    );
    const own = abwesenheiten.find((absence: { userName: string }) => absence.userName === viewers[role].name);
    expect(Boolean(own)).toBe(role === "Administrator");
    for (const absence of abwesenheiten) {
      expect(Object.keys(absence).sort()).toEqual(
        ["allDay", "endDate", "enteredBy", "id", "isOwn", "reason", "startDate", "timeFrom", "timeTo", "userId", "userName"]
      );
      expect(JSON.stringify(absence)).not.toContain("@example.com");
    }
    expect(
      abwesenheiten.map((absence: { userName: string; enteredBy: unknown }) => [absence.userName, absence.enteredBy]).sort()
    ).toEqual([
      ["Anna Admin", { kind: "self" }],
      ["Erika Beispiel", { kind: "self" }],
      ["Max Muster", { kind: "other", name: "Anna Admin" }],
    ]);
  });
});

describe("GET /api/kalender – Ausschreibungsverweis", () => {
  let linkedIds: Record<Visibility, string>;

  beforeAll(async () => {
    const linked = await Promise.all(
      LEVELS.map((level) =>
        createExternalEvent(`Mit Ausschreibung ${level}`, "2026-11-21", "2026-11-21", {
          ausschreibungId: ausschreibungen[level].id,
        })
      )
    );
    linkedIds = Object.fromEntries(LEVELS.map((level, index) => [level, linked[index].id])) as typeof linkedIds;
  });

  async function linkFor(level: Visibility) {
    const body = await fetchBody();
    return body.fremdtermine.find((entry: { id: string }) => entry.id === linkedIds[level]).ausschreibung;
  }

  it("verlinkt für Anonyme nur öffentliche Ausschreibungen", async () => {
    logout();
    expect(await linkFor("PUBLIC")).toEqual({
      id: ausschreibungen.PUBLIC.id,
      title: "Ausschreibung PUBLIC",
      fileUrl: `/api/ausschreibungen/${ausschreibungen.PUBLIC.id}/file`,
    });
    expect(await linkFor("MEMBER")).toBeNull();
    expect(await linkFor("HIDDEN")).toBeNull();
  });

  it("verlinkt für Eingeloggte auch Mitglieder-Ausschreibungen, verborgene nie", async () => {
    actAs("Mitglied");
    expect(await linkFor("MEMBER")).toMatchObject({ id: ausschreibungen.MEMBER.id });
    expect(await linkFor("HIDDEN")).toBeNull();

    actAs("Administrator");
    expect(await linkFor("HIDDEN")).toBeNull();
  });
});

describe("GET /api/kalender – Zeitraumgrenzen", () => {
  it("liefert mehrtägige Fremdtermine, die den Zeitraum am Rand berühren", async () => {
    const touchingStart = await createExternalEvent("Rand vorn", "2026-10-28", "2026-11-01");
    const touchingEnd = await createExternalEvent("Rand hinten", "2026-11-30", "2026-12-02");
    const spanning = await createExternalEvent("Übergreifend", "2026-10-15", "2026-12-15");
    const before = await createExternalEvent("Davor", "2026-10-20", "2026-10-31");
    const after = await createExternalEvent("Danach", "2026-12-01", "2026-12-03");
    logout();

    const fremdIds = ids((await fetchBody()).fremdtermine);
    expect(fremdIds).toEqual(expect.arrayContaining([touchingStart.id, touchingEnd.id, spanning.id]));
    expect(fremdIds).not.toContain(before.id);
    expect(fremdIds).not.toContain(after.id);
  });

  it("enthält Termine am ersten und letzten Tag, aber nicht außerhalb", async () => {
    logout();
    const body = await fetchBody("von=2026-10-31&bis=2026-11-10");
    const titles = body.termine.map((entry: { title: string }) => entry.title);
    expect(titles).toEqual(["Oktober", "Termin PUBLIC"]);
  });

  it("liefert Abwesenheiten, die über den Zeitraum hinausreichen", async () => {
    actAs("Mitglied");
    const { abwesenheiten } = await fetchBody("von=2026-11-04&bis=2026-11-04");
    expect(abwesenheiten.map((absence: { reason: string }) => absence.reason)).toEqual(["Urlaub"]);
  });
});

describe("GET /api/kalender – Validierung und Cache", () => {
  it.each([
    ["ohne Parameter", ""],
    ["ohne bis", "von=2026-11-01"],
    ["ungültiges Format", "von=01.11.2026&bis=2026-11-30"],
    ["nicht existierendes Datum", "von=2026-02-30&bis=2026-03-10"],
    ["bis vor von", "von=2026-11-30&bis=2026-11-01"],
    ["mehr als 100 Tage", "von=2026-01-01&bis=2026-04-11"],
  ])("antwortet mit 400 bei %s", async (_case, query) => {
    logout();
    const response = await fetchCalendar(query);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });

  it("akzeptiert genau 100 Tage", async () => {
    logout();
    expect((await fetchCalendar("von=2026-01-01&bis=2026-04-10")).status).toBe(200);
  });

  it("anonyme Antworten sind öffentlich cachebar, authentifizierte nicht", async () => {
    logout();
    const anonymous = await fetchCalendar();
    expect(anonymous.headers.get("Cache-Control")).toContain("public");
    expect(anonymous.headers.get("Vary")).toContain("Cookie");

    actAs("Mitglied");
    const authenticated = await fetchCalendar();
    expect(authenticated.headers.get("Cache-Control")).toContain("no-store");
    expect(authenticated.headers.get("Cache-Control")).not.toContain("public");
  });
});

import type { Event, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getCollisions } from "@/app/api/admin/kollisionen/route";
import { GET as getCalendar } from "@/app/api/kalender/route";
import { apiRequest } from "./helpers/api";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createAuditor, createEvent, createSiteAdministrator, createUser } from "./helpers/factories";

const NOW = new Date("2026-10-19T12:00:00+02:00");
const OCTOBER = "von=2026-10-19&bis=2026-10-31";

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

let admin: User;
let auditor: User;
let siteAdmin: User;
let member: User;
let otherMember: User;
let training: Event;
let meisterschaft: Event;

function termin(date: string, timeFrom: string, extra: Partial<Event> = {}) {
  return createEvent({ date: localDate(date, Number(timeFrom.slice(0, 2))), timeFrom, timeTo: "23:30", ...extra });
}

beforeAll(async () => {
  admin = await createAdmin({ name: "Anna Admin" });
  auditor = await createAuditor({ name: "Paul Prüfer" });
  siteAdmin = await createSiteAdministrator({ name: "Sina System" });
  member = await createUser({ name: "Max Muster" });
  otherMember = await createUser({ name: "Erika Beispiel" });

  training = await termin("2026-10-24", "18:00", { title: null, type: "Training", visibility: "HIDDEN" });
  meisterschaft = await termin("2026-10-24", "10:00", { title: "Vereinsmeisterschaft", type: "Wettkampf", visibility: "MEMBER" });
  await termin("2026-10-25", "23:00", { title: "Nachtlehrgang", type: "Lehrgang" });
  await termin("2026-10-26", "08:00", { title: "Montagstraining" });
  await termin("2026-10-27", "18:00", { title: "Freier Dienstag" });
  await termin("2026-10-29", "18:00", { title: "Öffentlich", visibility: "PUBLIC" });
  await termin("2026-10-29", "20:00", { title: "Verborgen", visibility: "HIDDEN" });

  await prisma.externalEvent.createMany({
    data: [
      {
        title: "Übungsschießen",
        kind: "RDL",
        startDate: localDate("2026-10-23"),
        endDate: localDate("2026-10-25"),
        visibility: "HIDDEN",
      },
      { title: "Landesmeisterschaft", kind: "COMPETITION", startDate: localDate("2026-10-28"), endDate: localDate("2026-10-28") },
    ],
  });

  await prisma.absence.createMany({
    data: [
      { userId: member.id, startDate: localDate("2026-10-24"), endDate: localDate("2026-10-24"), reason: "Familienfeier" },
      { userId: otherMember.id, startDate: localDate("2026-10-22"), endDate: localDate("2026-10-26") },
      {
        userId: admin.id,
        startDate: localDate("2026-10-28"),
        endDate: localDate("2026-10-28"),
        allDay: false,
        timeFrom: "08:00",
        timeTo: "10:00",
      },
    ],
  });
});

function fetchCollisions(query: string) {
  return getCollisions(apiRequest("GET", `/api/admin/kollisionen?${query}`));
}

async function calendarBody(query = OCTOBER) {
  const response = await getCalendar(apiRequest("GET", `/api/kalender?${query}`));
  expect(response.status).toBe(200);
  return response.json();
}

describe("Kalender-API: Kollisionstage", () => {
  it.each([
    ["Administrator", () => admin],
    ["Prüfer", () => auditor],
    ["Systemadministrator", () => siteAdmin],
  ])("liefert %s die Kollisionstage inklusive verborgener Einträge und Abwesenheiten je Tag", async (_label, viewer) => {
    loginAs(viewer());
    const body = await calendarBody();
    expect(body.kollisionen).toEqual(["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-29"]);
  });

  it("liefert Mitgliedern und anonymen Besuchern kein Feld kollisionen", async () => {
    loginAs(member);
    expect(await calendarBody()).not.toHaveProperty("kollisionen");

    logout();
    expect(await calendarBody()).not.toHaveProperty("kollisionen");
  });

  it("wertet nur den angefragten Zeitraum aus", async () => {
    loginAs(admin);
    expect((await calendarBody("von=2026-10-26&bis=2026-10-28")).kollisionen).toEqual(["2026-10-26"]);
  });
});

describe("GET /api/admin/kollisionen", () => {
  it("liefert Administratoren alle Einträge des Tages mit aggregierten Abwesenheiten", async () => {
    loginAs(admin);
    const response = await fetchCollisions("datum=2026-10-24");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");

    const body = await response.json();
    expect(body.date).toBe("2026-10-24");
    expect(body.termine).toEqual([
      {
        id: meisterschaft.id,
        label: "Vereinsmeisterschaft",
        timeFrom: "10:00",
        timeTo: "23:30",
        type: "Wettkampf",
        visibility: "MEMBER",
      },
      { id: training.id, label: "Training", timeFrom: "18:00", timeTo: "23:30", type: "Training", visibility: "HIDDEN" },
    ]);
    expect(body.fremdtermine).toEqual([
      expect.objectContaining({
        title: "Übungsschießen",
        kind: "RDL",
        startDate: "2026-10-23",
        endDate: "2026-10-25",
        allDay: true,
      }),
    ]);
    expect(body.abwesenheiten).toEqual({ count: 2, names: ["Erika Beispiel", "Max Muster"] });
    expect(JSON.stringify(body)).not.toContain("Familienfeier");
  });

  it("nimmt den bearbeiteten Termin mit ohneTermin aus", async () => {
    loginAs(admin);
    const body = await (await fetchCollisions(`datum=2026-10-24&ohneTermin=${training.id}`)).json();
    expect(body.termine.map((entry: { id: string }) => entry.id)).toEqual([meisterschaft.id]);
    expect(body.fremdtermine).toHaveLength(1);
    expect(body.abwesenheiten.count).toBe(2);
  });

  it("zählt mehrtägige Abwesenheiten an jedem berührten Tag, auch über die Zeitumstellung", async () => {
    loginAs(auditor);
    const sunday = await (await fetchCollisions("datum=2026-10-25")).json();
    expect(sunday.abwesenheiten).toEqual({ count: 1, names: ["Erika Beispiel"] });
    expect(sunday.termine.map((entry: { label: string }) => entry.label)).toEqual(["Nachtlehrgang"]);

    const monday = await (await fetchCollisions("datum=2026-10-26")).json();
    expect(monday.abwesenheiten.count).toBe(1);
    expect(monday.fremdtermine).toEqual([]);

    const tuesday = await (await fetchCollisions("datum=2026-10-27")).json();
    expect(tuesday.abwesenheiten).toEqual({ count: 0, names: [] });
  });

  it("liefert für einen Tag ohne Termin die Einträge, die ein neuer Termin dort berühren würde", async () => {
    loginAs(admin);
    const body = await (await fetchCollisions("datum=2026-10-28")).json();
    expect(body.termine).toEqual([]);
    expect(body.fremdtermine.map((entry: { title: string }) => entry.title)).toEqual(["Landesmeisterschaft"]);
    expect(body.abwesenheiten).toEqual({ count: 1, names: ["Anna Admin"] });
  });

  it("verweigert Mitgliedern (403) und anonymen Besuchern (401) den Zugriff", async () => {
    loginAs(member);
    expect((await fetchCollisions("datum=2026-10-24")).status).toBe(403);

    logout();
    expect((await fetchCollisions("datum=2026-10-24")).status).toBe(401);
  });

  it.each([
    ["ohne datum", ""],
    ["mit ungültigem Datum", "datum=2026-02-30"],
    ["mit deutschem Datumsformat", "datum=24.10.2026"],
    ["mit leerem ohneTermin", "datum=2026-10-24&ohneTermin="],
    ["mit ungültigem ohneTermin", "datum=2026-10-24&ohneTermin=a%20b"],
  ])("antwortet %s mit 400", async (_label, query) => {
    loginAs(admin);
    const response = await fetchCollisions(query);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

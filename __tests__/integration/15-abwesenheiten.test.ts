import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as listAbsences, POST as createAbsence } from "@/app/api/abwesenheiten/route";
import { PUT as updateAbsence, DELETE as deleteAbsence } from "@/app/api/abwesenheiten/[id]/route";
import { DELETE as deleteUserRoute } from "@/app/api/admin/users/[id]/route";
import { formatDateForStorage, getLocalDateString } from "@/lib/date-picker-utils";
import { ACTIVE_ABSENCE_LIMIT_ERROR, loadAbsencesInRange, MAX_ACTIVE_ABSENCES_PER_USER } from "@/lib/absence-service";
import { runMaintenanceCleanup } from "@/lib/maintenance-worker";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createAuditor, createUser } from "./helpers/factories";

const PATH = "/api/abwesenheiten";

const VALID_BODY = {
  startDate: "2026-11-06",
  endDate: "2026-11-08",
  allDay: true,
  timeFrom: null,
  timeTo: null,
  reason: null,
};

const BROWSER_WITHOUT_ORIGIN = { "user-agent": "Mozilla/5.0" };

const NOW = new Date("2026-10-19T12:00:00+02:00");

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

let admin: User;
let auditor: User;
let member: User;
let otherMember: User;

beforeAll(async () => {
  admin = await createAdmin({ name: "Anna Admin" });
  auditor = await createAuditor({ name: "Paul Prüfer" });
  member = await createUser({ name: "Max Muster" });
  otherMember = await createUser({ name: "Erika Beispiel" });
});

function post(body: unknown) {
  return createAbsence(apiRequest("POST", PATH, { body }));
}

function put(id: string, body: unknown) {
  return updateAbsence(apiRequest("PUT", `${PATH}/${id}`, { body }), routeContext({ id }));
}

function remove(id: string) {
  return deleteAbsence(apiRequest("DELETE", `${PATH}/${id}`), routeContext({ id }));
}

function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function createAbsenceFor(user: User, startDate: string, endDate: string, reason: string | null = null) {
  return prisma.absence.create({
    data: { userId: user.id, startDate: localDate(startDate), endDate: localDate(endDate), reason },
  });
}

function daysFromToday(offset: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + offset);
  return getLocalDateString(date);
}

describe("Abwesenheiten über die API", () => {
  it.each([
    ["Mitglied", () => member],
    ["Administrator", () => admin],
    ["Prüfer", () => auditor],
  ])("%s legt an, liest, ändert und löscht eigene Abwesenheiten", async (_role, getUser) => {
    const user = getUser();
    loginAs(user);

    const created = await post({ ...VALID_BODY, startDate: daysFromToday(3), endDate: daysFromToday(5), reason: "  Urlaub  " });
    expect(created.status).toBe(201);
    const absence = await created.json();
    expect(absence).toMatchObject({
      startDate: daysFromToday(3),
      endDate: daysFromToday(5),
      allDay: true,
      timeFrom: null,
      timeTo: null,
      reason: "Urlaub",
    });
    expect(absence).not.toHaveProperty("userId");

    const stored = await prisma.absence.findUniqueOrThrow({ where: { id: absence.id } });
    expect(stored.userId).toBe(user.id);
    expect(formatDateForStorage(stored.startDate)).toBe(daysFromToday(3));

    const updated = await put(absence.id, {
      ...VALID_BODY,
      startDate: daysFromToday(4),
      endDate: daysFromToday(4),
      allDay: false,
      timeFrom: "08:00",
      timeTo: "12:00",
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      id: absence.id,
      startDate: daysFromToday(4),
      endDate: daysFromToday(4),
      allDay: false,
      timeFrom: "08:00",
      timeTo: "12:00",
      reason: null,
    });

    const list = await listAbsences();
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toContain("no-store");
    expect((await list.json()).absences.map((a: { id: string }) => a.id)).toContain(absence.id);

    expect((await remove(absence.id)).status).toBe(200);
    expect(await prisma.absence.findUnique({ where: { id: absence.id } })).toBeNull();
    expect((await remove(absence.id)).status).toBe(404);
  });

  it("begrenzt laufende und künftige Abwesenheiten auf 100 je Benutzer, auch beim Ändern", async () => {
    const user = await createUser({ name: "Viel Abwesend" });
    await prisma.absence.createMany({
      data: [
        ...Array.from({ length: MAX_ACTIVE_ABSENCES_PER_USER - 1 }, (_, index) => ({
          userId: user.id,
          startDate: localDate(daysFromToday(index)),
          endDate: localDate(daysFromToday(index)),
        })),
        { userId: user.id, startDate: localDate(daysFromToday(-5)), endDate: localDate(daysFromToday(-1)) },
      ],
    });
    loginAs(user);

    expect((await post({ ...VALID_BODY, startDate: daysFromToday(200), endDate: daysFromToday(200) })).status).toBe(201);

    const rejected = await post({ ...VALID_BODY, startDate: daysFromToday(201), endDate: daysFromToday(201) });
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).error).toBe(ACTIVE_ABSENCE_LIMIT_ERROR);
    expect(await prisma.absence.count({ where: { userId: user.id } })).toBe(MAX_ACTIVE_ABSENCES_PER_USER + 1);

    const past = await prisma.absence.findFirstOrThrow({ where: { userId: user.id, endDate: localDate(daysFromToday(-1)) } });
    const active = await prisma.absence.findFirstOrThrow({ where: { userId: user.id, endDate: localDate(daysFromToday(0)) } });

    expect((await put(active.id, { ...VALID_BODY, startDate: daysFromToday(300), endDate: daysFromToday(300) })).status).toBe(200);
    expect((await put(past.id, { ...VALID_BODY, startDate: daysFromToday(-4), endDate: daysFromToday(-2) })).status).toBe(200);

    const reactivated = await put(past.id, { ...VALID_BODY, startDate: daysFromToday(1), endDate: daysFromToday(2) });
    expect(reactivated.status).toBe(400);
    expect((await reactivated.json()).error).toBe(ACTIVE_ABSENCE_LIMIT_ERROR);
    const unchanged = await prisma.absence.findUniqueOrThrow({ where: { id: past.id } });
    expect(formatDateForStorage(unchanged.endDate)).toBe(daysFromToday(-2));

    loginAs(otherMember);
    expect((await put(active.id, { ...VALID_BODY, startDate: daysFromToday(1), endDate: daysFromToday(1) })).status).toBe(404);
    expect((await post({ ...VALID_BODY, startDate: daysFromToday(201), endDate: daysFromToday(201) })).status).toBe(201);
  });

  it("meldet 404 beim Ändern einer unbekannten Abwesenheit", async () => {
    loginAs(member);
    expect((await put("gibt-es-nicht", VALID_BODY)).status).toBe(404);
  });

  it("listet nur eigene Abwesenheiten, sortiert, ohne bereits abgelaufene", async () => {
    const user = await createUser();
    const later = await createAbsenceFor(user, daysFromToday(20), daysFromToday(22));
    const recent = await createAbsenceFor(user, daysFromToday(-10), daysFromToday(-8));
    const current = await createAbsenceFor(user, daysFromToday(-1), daysFromToday(1));
    await createAbsenceFor(user, daysFromToday(-40), daysFromToday(-31));
    await createAbsenceFor(otherMember, daysFromToday(2), daysFromToday(2));
    loginAs(user);

    const body = await (await listAbsences()).json();
    expect(body.absences.map((a: { id: string }) => a.id)).toEqual([recent.id, current.id, later.id]);
  });

  it.each([
    ["Mitglied", () => member],
    ["Administrator", () => admin],
  ])("%s erhält 404 für fremde Abwesenheiten, ohne sie zu verändern", async (_role, getUser) => {
    const foreign = await createAbsenceFor(otherMember, "2026-12-01", "2026-12-02", "Schicht");
    loginAs(getUser());

    expect((await put(foreign.id, { ...VALID_BODY, reason: "gekapert" })).status).toBe(404);
    expect((await remove(foreign.id)).status).toBe(404);

    const list = await (await listAbsences()).json();
    expect(list.absences.map((a: { id: string }) => a.id)).not.toContain(foreign.id);
    expect(await prisma.absence.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({
      reason: "Schicht",
      userId: otherMember.id,
    });
  });

  it("weist anonyme Zugriffe mit 401 ab", async () => {
    const existing = await createAbsenceFor(member, "2026-12-03", "2026-12-03");
    logout();

    expect((await listAbsences()).status).toBe(401);
    expect((await post(VALID_BODY)).status).toBe(401);
    expect((await put(existing.id, VALID_BODY)).status).toBe(401);
    expect((await remove(existing.id)).status).toBe(401);
    expect(await prisma.absence.findUnique({ where: { id: existing.id } })).not.toBeNull();
  });

  it("lehnt Schreibzugriffe ohne gültigen Origin ab", async () => {
    loginAs(member);
    const existing = await createAbsenceFor(member, "2026-12-04", "2026-12-04", "CSRF-Ziel");
    const before = await prisma.absence.count();

    const created = await createAbsence(apiRequest("POST", PATH, { body: VALID_BODY, headers: BROWSER_WITHOUT_ORIGIN }));
    const updated = await updateAbsence(
      apiRequest("PUT", `${PATH}/${existing.id}`, { body: VALID_BODY, headers: BROWSER_WITHOUT_ORIGIN }),
      routeContext({ id: existing.id })
    );
    const deleted = await deleteAbsence(
      apiRequest("DELETE", `${PATH}/${existing.id}`, { headers: BROWSER_WITHOUT_ORIGIN }),
      routeContext({ id: existing.id })
    );

    expect([created.status, updated.status, deleted.status]).toEqual([403, 403, 403]);
    expect(await prisma.absence.count()).toBe(before);
    expect(await prisma.absence.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ reason: "CSRF-Ziel" });
  });

  describe("Validierung", () => {
    beforeEach(() => loginAs(member));

    async function fieldErrorsOf(response: Response): Promise<Record<string, string>> {
      expect(response.status).toBe(400);
      const body = await response.json();
      return Object.fromEntries(body.fieldErrors.map((e: { field: string; message: string }) => [e.field, e.message]));
    }

    it("lehnt Ende vor Start und zu langen Grund ab", async () => {
      expect(await fieldErrorsOf(await post({ ...VALID_BODY, endDate: "2026-11-01", reason: "x".repeat(201) }))).toEqual({
        endDate: "„Bis“ darf nicht vor „Von“ liegen",
        reason: "Grund darf maximal 200 Zeichen haben",
      });
    });

    it("begrenzt die Dauer auf 365 Tage", async () => {
      const longest = await post({ ...VALID_BODY, startDate: "2026-11-01", endDate: "2027-10-31" });
      expect(longest.status).toBe(201);
      await prisma.absence.delete({ where: { id: (await longest.json()).id } });
      expect(await fieldErrorsOf(await post({ ...VALID_BODY, startDate: "2026-11-01", endDate: "9999-12-31" }))).toEqual({
        endDate: "Eine Abwesenheit darf höchstens 365 Tage dauern",
      });
    });

    it("akzeptiert einen Grund mit genau 200 Zeichen", async () => {
      expect((await post({ ...VALID_BODY, reason: "x".repeat(200) })).status).toBe(201);
    });

    it("verlangt ohne Ganztag Uhrzeiten mit Ende nach Beginn", async () => {
      expect(await fieldErrorsOf(await post({ ...VALID_BODY, allDay: false }))).toEqual({
        timeFrom: "Uhrzeit von ist erforderlich, wenn nicht ganztägig",
        timeTo: "Uhrzeit bis ist erforderlich, wenn nicht ganztägig",
      });
      expect(
        await fieldErrorsOf(
          await post({ ...VALID_BODY, endDate: VALID_BODY.startDate, allDay: false, timeFrom: "17:00", timeTo: "09:00" })
        )
      ).toEqual({ timeTo: "Uhrzeit bis muss nach Uhrzeit von liegen" });
    });

    it("lehnt ungültige Daten ab", async () => {
      expect(await fieldErrorsOf(await post({ ...VALID_BODY, startDate: "2026-02-30", endDate: "" }))).toEqual({
        startDate: "Von ist ungültig",
        endDate: "Bis ist erforderlich",
      });
    });

    it("verlangt alle Felder und meldet fehlende als Feldfehler", async () => {
      const { allDay, reason, ...partial } = VALID_BODY;
      void allDay;
      void reason;
      expect(await fieldErrorsOf(await post(partial))).toEqual({
        allDay: "Pflichtfeld fehlt: allDay",
        reason: "Pflichtfeld fehlt: reason",
      });
    });

    it("lehnt ein unvollständiges PUT ab, ohne Daten zu verlieren", async () => {
      const absence = await (await post({ ...VALID_BODY, reason: "Lehrgang" })).json();

      expect((await put(absence.id, { reason: "Nur der Grund" })).status).toBe(400);
      expect(await prisma.absence.findUniqueOrThrow({ where: { id: absence.id } })).toMatchObject({ reason: "Lehrgang" });
    });

    it("lehnt falsche Feldtypen und unbekannte Felder ab", async () => {
      expect((await post({ ...VALID_BODY, allDay: "ja" })).status).toBe(400);
      expect((await post({ ...VALID_BODY, userId: otherMember.id })).status).toBe(400);
    });
  });
});

describe("loadAbsencesInRange", () => {
  let rangeMember: User;
  let rangeOther: User;
  let ownId: string;
  let otherId: string;

  beforeAll(async () => {
    rangeMember = await createUser({ name: "Rita Reichweite", email: "rita@example.com" });
    rangeOther = await createUser({ name: "Otto Anders", email: "otto@example.com" });
    ownId = (await createAbsenceFor(rangeMember, "2027-03-10", "2027-03-12", "Urlaub")).id;
    otherId = (await createAbsenceFor(rangeOther, "2027-03-01", "2027-03-05", "Schicht")).id;
    await createAbsenceFor(rangeOther, "2027-02-01", "2027-02-28");
    await createAbsenceFor(rangeOther, "2027-04-01", "2027-04-02");
  });

  const RANGE = { from: "2027-03-05", to: "2027-03-10" };

  it("lässt Abwesenheiten jenseits der Löschfrist aus, auch wenn der Zeitraum sie abdeckt", async () => {
    const user = await createUser();
    await createAbsenceFor(user, "2026-09-10", "2026-09-18");
    const boundary = await createAbsenceFor(user, "2026-09-12", "2026-09-19");

    const result = await loadAbsencesInRange({ id: user.id, role: "MEMBER" }, { from: "2026-09-01", to: "2026-10-31" });

    expect(result.map((a) => a.id)).toEqual([boundary.id]);
  });

  it("liefert Mitgliedern nur eigene Abwesenheiten", async () => {
    const result = await loadAbsencesInRange({ id: rangeMember.id, role: "MEMBER" }, RANGE);
    expect(result).toEqual([
      {
        id: ownId,
        startDate: "2027-03-10",
        endDate: "2027-03-12",
        allDay: true,
        timeFrom: null,
        timeTo: null,
        reason: "Urlaub",
        userName: "Rita Reichweite",
        isOwn: true,
      },
    ]);
  });

  it.each([
    ["ADMIN", () => admin],
    ["AUDITOR", () => auditor],
    ["SITE_ADMINISTRATOR", () => admin],
  ])("liefert %s alle überlappenden Abwesenheiten mit Namen, ohne E-Mail", async (role, getUser) => {
    const result = await loadAbsencesInRange({ id: getUser().id, role }, RANGE);

    expect(result.map((a) => [a.id, a.userName, a.isOwn])).toEqual([
      [otherId, "Otto Anders", false],
      [ownId, "Rita Reichweite", false],
    ]);
    expect(JSON.stringify(result)).not.toContain("@example.com");
    expect(Object.keys(result[0]).sort()).toEqual(
      ["allDay", "endDate", "id", "isOwn", "reason", "startDate", "timeFrom", "timeTo", "userName"].sort()
    );
  });
});

describe("Löschfrist", () => {
  it("löscht Abwesenheiten 31 Tage nach Ende und behält sie bis einschließlich 30 Tage", async () => {
    const user = await createUser();
    const expired = await createAbsenceFor(user, "2026-09-10", "2026-09-18");
    const boundary = await createAbsenceFor(user, "2026-09-10", "2026-09-19");
    const ongoing = await createAbsenceFor(user, "2026-10-18", "2026-10-25");

    const result = await runMaintenanceCleanup(NOW);

    expect(result.deletedAbsences).toBeGreaterThanOrEqual(1);
    expect(await prisma.absence.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.absence.findUnique({ where: { id: boundary.id } })).not.toBeNull();
    expect(await prisma.absence.findUnique({ where: { id: ongoing.id } })).not.toBeNull();
  });

  it("rechnet mit dem Berliner Kalendertag, auch kurz nach Mitternacht", async () => {
    const user = await createUser();
    const expired = await createAbsenceFor(user, "2026-09-18", "2026-09-18");
    const kept = await createAbsenceFor(user, "2026-09-19", "2026-09-19");

    await runMaintenanceCleanup(new Date("2026-10-18T22:30:00.000Z"));

    expect(await prisma.absence.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.absence.findUnique({ where: { id: kept.id } })).not.toBeNull();
  });
});

describe("Benutzer löschen", () => {
  it("entfernt die Abwesenheiten des Benutzers über die Admin-Route", async () => {
    const leaving = await createUser();
    const own = await createAbsenceFor(leaving, "2026-12-10", "2026-12-12");
    const foreign = await createAbsenceFor(otherMember, "2026-12-10", "2026-12-12");
    loginAs(admin);

    const response = await deleteUserRoute(
      apiRequest("DELETE", `/api/admin/users/${leaving.id}`),
      routeContext({ id: leaving.id })
    );

    expect(response.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: leaving.id } })).toBeNull();
    expect(await prisma.absence.findUnique({ where: { id: own.id } })).toBeNull();
    expect(await prisma.absence.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });
});

import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as listExternalEvents, POST as createExternalEvent } from "@/app/api/admin/fremdtermine/route";
import { GET as getExternalEvent, PUT as updateExternalEvent, DELETE as deleteExternalEvent } from "@/app/api/admin/fremdtermine/[id]/route";
import { DELETE as deleteAusschreibung } from "@/app/api/admin/ausschreibungen/[id]/route";
import { formatDateForStorage } from "@/lib/date-picker-utils";
import { writeAusschreibungFile } from "@/lib/ausschreibung-storage";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs, logout } from "./helpers/auth";
import { createAdmin, createAuditor, createUser } from "./helpers/factories";

const PATH = "/api/admin/fremdtermine";

const VALID_BODY = {
  title: "RDL Schießausbildung",
  startDate: "2026-11-06",
  endDate: "2026-11-08",
  allDay: true,
  timeFrom: null,
  timeTo: null,
  location: null,
  description: null,
  url: null,
  kind: null,
  visibility: "MEMBER",
  ausschreibungId: null,
};

const BROWSER_WITHOUT_ORIGIN = { "user-agent": "Mozilla/5.0" };

let admin: User;
let auditor: User;
let member: User;

beforeAll(async () => {
  admin = await createAdmin();
  auditor = await createAuditor();
  member = await createUser();
});

function post(body: unknown) {
  return createExternalEvent(apiRequest("POST", PATH, { body }));
}

function put(id: string, body: unknown) {
  return updateExternalEvent(apiRequest("PUT", `${PATH}/${id}`, { body }), routeContext({ id }));
}

function get(id: string) {
  return getExternalEvent(apiRequest("GET", `${PATH}/${id}`), routeContext({ id }));
}

function remove(id: string) {
  return deleteExternalEvent(apiRequest("DELETE", `${PATH}/${id}`), routeContext({ id }));
}

async function createAusschreibungRecord(title: string) {
  const { storedFileName } = await writeAusschreibungFile({ content: Buffer.from("%PDF-1.4\n") });
  return prisma.ausschreibung.create({
    data: {
      title,
      expiresAt: new Date("2026-12-31T00:00:00Z"),
      originalFileName: "ausschreibung.pdf",
      storedFileName,
      mimeType: "application/pdf",
      sizeBytes: 1024,
    },
  });
}

describe("Fremdtermine im Adminbereich", () => {
  it("Administrator legt an, liest, ändert und löscht einen Fremdtermin", async () => {
    loginAs(admin);

    const created = await post({ ...VALID_BODY, kind: "RDL", url: "https://example.org/rdl", location: "Lehnin" });
    expect(created.status).toBe(201);
    const externalEvent = await created.json();
    expect(externalEvent).toMatchObject({
      title: "RDL Schießausbildung",
      startDate: "2026-11-06",
      endDate: "2026-11-08",
      allDay: true,
      timeFrom: null,
      timeTo: null,
      kind: "RDL",
      visibility: "MEMBER",
      location: "Lehnin",
      url: "https://example.org/rdl",
      ausschreibung: null,
    });

    const stored = await prisma.externalEvent.findUniqueOrThrow({ where: { id: externalEvent.id } });
    expect(formatDateForStorage(stored.startDate)).toBe("2026-11-06");
    expect(stored.createdById).toBe(admin.id);

    const updated = await put(externalEvent.id, {
      ...VALID_BODY,
      title: "RK-Pokal",
      endDate: "2026-11-06",
      allDay: false,
      timeFrom: "09:00",
      timeTo: "17:00",
      kind: "COMPETITION",
      visibility: "PUBLIC",
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      title: "RK-Pokal",
      endDate: "2026-11-06",
      allDay: false,
      timeFrom: "09:00",
      timeTo: "17:00",
      kind: "COMPETITION",
      visibility: "PUBLIC",
      location: null,
      url: null,
    });

    const list = await listExternalEvents();
    expect((await list.json()).externalEvents.map((e: { id: string }) => e.id)).toContain(externalEvent.id);

    expect((await remove(externalEvent.id)).status).toBe(200);
    expect(await prisma.externalEvent.findUnique({ where: { id: externalEvent.id } })).toBeNull();
    expect((await remove(externalEvent.id)).status).toBe(404);
  });

  it("leert die Uhrzeiten, sobald der Fremdtermin ganztägig ist", async () => {
    loginAs(admin);
    const response = await post({ ...VALID_BODY, allDay: true, timeFrom: "09:00", timeTo: "17:00" });
    expect(await response.json()).toMatchObject({ timeFrom: null, timeTo: null });
  });

  it("Prüfer liest die Liste, darf aber nichts ändern", async () => {
    const existing = await prisma.externalEvent.create({
      data: { title: "Bestand", startDate: new Date(2026, 10, 1), endDate: new Date(2026, 10, 1) },
    });
    loginAs(auditor);

    const list = await listExternalEvents();
    expect(list.status).toBe(200);
    expect((await list.json()).externalEvents.map((e: { id: string }) => e.id)).toContain(existing.id);

    expect((await post(VALID_BODY)).status).toBe(403);
    expect((await put(existing.id, VALID_BODY)).status).toBe(403);
    expect((await remove(existing.id)).status).toBe(403);
    expect(await prisma.externalEvent.findUnique({ where: { id: existing.id } })).toMatchObject({ title: "Bestand" });
  });

  it.each([
    ["Mitglied", 403],
    ["anonym", 401],
  ])("%s wird abgewiesen", async (role, status) => {
    if (role === "anonym") logout();
    else loginAs(member);

    expect((await listExternalEvents()).status).toBe(status);
    expect((await post(VALID_BODY)).status).toBe(status);
  });

  describe("Einzelabruf", () => {
    it("liefert Administratoren und Prüfern den vollständigen Datensatz samt verborgener Ausschreibung", async () => {
      const ausschreibung = await createAusschreibungRecord("Verborgene Ausschreibung");
      await prisma.ausschreibung.update({ where: { id: ausschreibung.id }, data: { visibility: "HIDDEN" } });
      const existing = await prisma.externalEvent.create({
        data: {
          title: "Einzeln",
          startDate: new Date(2026, 10, 2),
          endDate: new Date(2026, 10, 3),
          visibility: "HIDDEN",
          ausschreibungId: ausschreibung.id,
        },
      });

      for (const user of [admin, auditor]) {
        loginAs(user);
        const response = await get(existing.id);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          id: existing.id,
          title: "Einzeln",
          startDate: "2026-11-02",
          endDate: "2026-11-03",
          visibility: "HIDDEN",
          ausschreibungId: ausschreibung.id,
          ausschreibung: { id: ausschreibung.id, title: "Verborgene Ausschreibung" },
        });
      }
    });

    it("weist Mitglieder ab und meldet 404 für unbekannte Fremdtermine", async () => {
      const existing = await prisma.externalEvent.create({
        data: { title: "Geheim", startDate: new Date(2026, 10, 2), endDate: new Date(2026, 10, 2) },
      });
      loginAs(member);
      expect((await get(existing.id)).status).toBe(403);

      loginAs(admin);
      expect((await get("gibt-es-nicht")).status).toBe(404);
    });
  });

  it("Löschen der Ausschreibung setzt den Verweis auf null", async () => {
    loginAs(admin);
    const ausschreibung = await createAusschreibungRecord("Ausschreibung RK-Pokal");

    const created = await post({ ...VALID_BODY, ausschreibungId: ausschreibung.id });
    const externalEvent = await created.json();
    expect(externalEvent.ausschreibung).toEqual({ id: ausschreibung.id, title: "Ausschreibung RK-Pokal" });

    const deleted = await deleteAusschreibung(
      apiRequest("DELETE", `/api/admin/ausschreibungen/${ausschreibung.id}`),
      routeContext({ id: ausschreibung.id })
    );
    expect(deleted.status).toBe(200);

    const stored = await prisma.externalEvent.findUniqueOrThrow({ where: { id: externalEvent.id } });
    expect(stored.ausschreibungId).toBeNull();
  });

  it("lehnt Schreibzugriffe ohne gültigen Origin ab", async () => {
    loginAs(admin);
    const existing = await prisma.externalEvent.create({
      data: { title: "CSRF-Ziel", startDate: new Date(2026, 10, 1), endDate: new Date(2026, 10, 1) },
    });
    const before = await prisma.externalEvent.count();

    const created = await createExternalEvent(apiRequest("POST", PATH, { body: VALID_BODY, headers: BROWSER_WITHOUT_ORIGIN }));
    const updated = await updateExternalEvent(
      apiRequest("PUT", `${PATH}/${existing.id}`, { body: VALID_BODY, headers: BROWSER_WITHOUT_ORIGIN }),
      routeContext({ id: existing.id })
    );
    const deleted = await deleteExternalEvent(
      apiRequest("DELETE", `${PATH}/${existing.id}`, { headers: BROWSER_WITHOUT_ORIGIN }),
      routeContext({ id: existing.id })
    );

    expect([created.status, updated.status, deleted.status]).toEqual([403, 403, 403]);
    expect(await prisma.externalEvent.count()).toBe(before);
    expect(await prisma.externalEvent.findUnique({ where: { id: existing.id } })).toMatchObject({ title: "CSRF-Ziel" });
  });

  it("Löschen des Erstellers setzt createdById auf null", async () => {
    const creator = await createAdmin();
    loginAs(creator);
    const externalEvent = await (await post(VALID_BODY)).json();
    expect(externalEvent).not.toHaveProperty("createdById");

    await prisma.user.delete({ where: { id: creator.id } });

    const stored = await prisma.externalEvent.findUniqueOrThrow({ where: { id: externalEvent.id } });
    expect(stored.createdById).toBeNull();
  });

  describe("Validierung", () => {
    beforeEach(() => loginAs(admin));

    async function fieldErrorsOf(response: Response): Promise<Record<string, string>> {
      expect(response.status).toBe(400);
      const body = await response.json();
      return Object.fromEntries(body.fieldErrors.map((e: { field: string; message: string }) => [e.field, e.message]));
    }

    it("lehnt fehlenden Titel, Ende vor Start und unsicheren Link ab", async () => {
      const errors = await fieldErrorsOf(
        await post({ ...VALID_BODY, title: " ", endDate: "2026-11-01", url: "javascript:alert(1)" })
      );
      expect(errors).toEqual({
        title: "Titel ist erforderlich",
        endDate: "„Bis“ darf nicht vor „Von“ liegen",
        url: "Link muss mit http:// oder https:// beginnen",
      });
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

    it("lehnt unbekannte Art, Sichtbarkeitsstufe und Ausschreibung ab", async () => {
      const errors = await fieldErrorsOf(await post({ ...VALID_BODY, kind: "PARTY", visibility: "SECRET" }));
      expect(errors.kind).toBe("Art muss RDL, RK-Veranstaltung, Wettkampf oder Sonstiges sein");
      expect(errors.visibility).toContain("Sichtbarkeitsstufe muss");

      expect(await fieldErrorsOf(await post({ ...VALID_BODY, ausschreibungId: "gibt-es-nicht" }))).toEqual({
        ausschreibungId: "Ausschreibung nicht gefunden",
      });
    });

    it("verlangt allDay und alle übrigen Felder als Feldfehler", async () => {
      const { allDay, visibility, ...partial } = VALID_BODY;
      void allDay;
      void visibility;
      expect(await fieldErrorsOf(await post(partial))).toEqual({
        allDay: "Pflichtfeld fehlt: allDay",
        visibility: "Pflichtfeld fehlt: visibility",
      });
    });

    it("lehnt ein unvollständiges PUT ab, ohne Daten zu verlieren", async () => {
      const externalEvent = await (await post({ ...VALID_BODY, location: "Lehnin", kind: "RDL", visibility: "PUBLIC" })).json();

      const response = await put(externalEvent.id, { title: "Nur der Titel" });
      expect(response.status).toBe(400);

      const stored = await prisma.externalEvent.findUniqueOrThrow({ where: { id: externalEvent.id } });
      expect(stored).toMatchObject({ title: VALID_BODY.title, location: "Lehnin", kind: "RDL", visibility: "PUBLIC" });
    });

    it("lehnt falsche Feldtypen ab", async () => {
      const response = await post({ ...VALID_BODY, allDay: "ja" });
      expect(response.status).toBe(400);
    });

    it("meldet 404 beim Ändern eines unbekannten Fremdtermins", async () => {
      expect((await put("gibt-es-nicht", VALID_BODY)).status).toBe(404);
    });
  });
});

import { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getAdminUsers, POST as postAdminUsers } from "@/app/api/admin/users/route";
import { GET as getAdminEvents, POST as postAdminEvents } from "@/app/api/admin/events/route";
import { GET as getAdminNews, POST as postAdminNews } from "@/app/api/admin/news/route";
import {
  GET as getAdminDocumentDirectories,
  POST as postAdminDocumentDirectories,
} from "@/app/api/admin/document-directories/route";
import { GET as getAdminPolls, POST as postAdminPolls } from "@/app/api/admin/polls/route";
import { GET as getAdminAusschreibungen } from "@/app/api/admin/ausschreibungen/route";
import { PATCH as patchAdminAusschreibung } from "@/app/api/admin/ausschreibungen/[id]/route";
import { GET as getAdminRanges, POST as postAdminRanges } from "@/app/api/admin/ranges/route";
import { POST as postAdminInvitations } from "@/app/api/admin/invitations/route";
import { GET as getAdminOutgoingEmails } from "@/app/api/admin/outgoing-emails/route";
import { GET as getAdminNotifications } from "@/app/api/admin/notifications/route";
import { POST as postImpersonate } from "@/app/api/admin/users/[id]/impersonate/route";
import { GET as getPublicAusschreibungen } from "@/app/api/ausschreibungen/route";
import { isAusschreibungCurrent, splitAndSortAusschreibungen } from "@/lib/ausschreibung-validation";
import { getGermanDateString, parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import { createAdmin, createAuditor, createSiteAdministrator, createUser } from "./helpers/factories";

// ---------------------------------------------------------------------------
// Lokale Hilfsfunktionen (Helpers unter helpers/ bleiben unangetastet)
// ---------------------------------------------------------------------------

const TAG_IN_MS = 24 * 60 * 60 * 1000;

let laufendeNummer = 0;
function nächsteNummer(): number {
  laufendeNummer += 1;
  return laufendeNummer;
}

// Die Ausschreibungs-Routen lesen FormData; apiRequest aus helpers/api.ts baut
// nur JSON-Requests, deshalb hier ein eigener FormData-Request-Bauer.
function formDataRequest(method: string, path: string, fields: Record<string, string>): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest(`http://localhost:3000${path}`, { method, body: formData });
}

// Legt eine Ausschreibung direkt in der DB an — für die Listen-Route und die
// PATCH-Rechteprüfung ist keine echte PDF-Datei nötig.
async function createAusschreibungRecord(expiresAt: Date, title?: string) {
  const seq = nächsteNummer();
  return prisma.ausschreibung.create({
    data: {
      title: title ?? `Testausschreibung ${seq}`,
      expiresAt,
      originalFileName: `ausschreibung-${seq}.pdf`,
      storedFileName: `stored-${seq}-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
    },
  });
}

// UTC-Mitternacht des heutigen Kalendertags in Europe/Berlin — so speichert
// auch die Admin-Route das Ablaufdatum (parseAusschreibungExpiresAt).
function heuteUtcMitternacht(): Date {
  return parseIsoDateOnlyToUtcDate(getGermanDateString(new Date()));
}

type RollenName = "SITE_ADMINISTRATOR" | "ADMIN" | "AUDITOR" | "MEMBER";

let siteAdministrator: User;
let admin: User;
let auditor: User;
let member: User;
let matrixAusschreibungId: string;

function benutzerFürRolle(rolle: RollenName): User {
  switch (rolle) {
    case "SITE_ADMINISTRATOR":
      return siteAdministrator;
    case "ADMIN":
      return admin;
    case "AUDITOR":
      return auditor;
    case "MEMBER":
      return member;
  }
}

beforeAll(async () => {
  siteAdministrator = await createSiteAdministrator();
  admin = await createAdmin();
  auditor = await createAuditor();
  member = await createUser();
  // Zieldatensatz für die PATCH-Schreiboperation der Ausschreibungs-Gruppe
  const matrixAusschreibung = await createAusschreibungRecord(
    new Date(heuteUtcMitternacht().getTime() + TAG_IN_MS),
    "Matrix-Ausschreibung"
  );
  matrixAusschreibungId = matrixAusschreibung.id;
});

// ---------------------------------------------------------------------------
// Routengruppen der Rollenmatrix
// ---------------------------------------------------------------------------

interface GetGruppe {
  name: string;
  invoke: () => Promise<Response>;
}

const adminGetGruppen: GetGruppe[] = [
  { name: "Benutzer (GET /api/admin/users)", invoke: () => getAdminUsers() },
  { name: "Termine (GET /api/admin/events)", invoke: () => getAdminEvents(apiRequest("GET", "/api/admin/events")) },
  { name: "News (GET /api/admin/news)", invoke: () => getAdminNews(apiRequest("GET", "/api/admin/news")) },
  {
    name: "Dokument-Verzeichnisse (GET /api/admin/document-directories)",
    invoke: () => getAdminDocumentDirectories(apiRequest("GET", "/api/admin/document-directories")),
  },
  { name: "Umfragen (GET /api/admin/polls)", invoke: () => getAdminPolls(apiRequest("GET", "/api/admin/polls")) },
  { name: "Ausschreibungen (GET /api/admin/ausschreibungen)", invoke: () => getAdminAusschreibungen() },
  { name: "Standorte (GET /api/admin/ranges)", invoke: () => getAdminRanges() },
];

interface SchreibGruppe {
  name: string;
  // Baut je Aufruf einen frischen Request (Bodies sind nur einmal lesbar) mit
  // gültigem, eindeutigem Inhalt — Ablehnung muss VOR der Validierung greifen.
  invoke: () => Promise<Response>;
  // Vergleichswert für den Vorher/Nachher-Nachweis, dass die DB unverändert ist.
  snapshot: () => Promise<unknown>;
  erfolgsStatus: number;
}

const schreibGruppen: SchreibGruppe[] = [
  {
    name: "Benutzer (POST /api/admin/users)",
    invoke: () =>
      postAdminUsers(
        apiRequest("POST", "/api/admin/users", {
          body: { email: `matrix-benutzer-${nächsteNummer()}@example.com`, name: "Matrix Testbenutzer" },
        })
      ),
    snapshot: () => prisma.user.count(),
    erfolgsStatus: 201,
  },
  {
    name: "Termine (POST /api/admin/events)",
    invoke: () =>
      postAdminEvents(
        apiRequest("POST", "/api/admin/events", {
          body: {
            date: "2027-06-15",
            timeFrom: "10:00",
            timeTo: "12:00",
            location: `Matrix-Schießstand ${nächsteNummer()}`,
            description: "<p>Matrix-Termin für die Rollenprüfung</p>",
            // unsichtbar anlegen, damit kein Erinnerungs-Versand angestoßen wird
            visible: false,
          },
        })
      ),
    snapshot: () => prisma.event.count(),
    erfolgsStatus: 201,
  },
  {
    name: "News (POST /api/admin/news)",
    invoke: () =>
      postAdminNews(
        apiRequest("POST", "/api/admin/news", {
          body: {
            title: `Matrix-News ${nächsteNummer()}`,
            content: "Inhalt für die Rollenmatrix",
            newsDate: "2027-06-15",
          },
        })
      ),
    snapshot: () => prisma.news.count(),
    erfolgsStatus: 201,
  },
  {
    name: "Dokument-Verzeichnisse (POST /api/admin/document-directories)",
    invoke: () =>
      postAdminDocumentDirectories(
        apiRequest("POST", "/api/admin/document-directories", {
          body: { name: `Matrix-Verzeichnis ${nächsteNummer()}` },
        })
      ),
    snapshot: () => prisma.documentDirectory.count(),
    erfolgsStatus: 201,
  },
  {
    name: "Umfragen (POST /api/admin/polls)",
    invoke: () =>
      postAdminPolls(
        apiRequest("POST", "/api/admin/polls", {
          body: {
            title: `Matrix-Umfrage ${nächsteNummer()}`,
            type: "SONSTIGES",
            options: [{ text: "Ja" }, { text: "Nein" }],
          },
        })
      ),
    snapshot: () => prisma.poll.count(),
    erfolgsStatus: 201,
  },
  {
    // POST bräuchte einen echten PDF-Upload; die Rechteprüfung läuft stattdessen
    // über PATCH auf einem direkt in der DB angelegten Datensatz (laut Issue erlaubt).
    name: "Ausschreibungen (PATCH /api/admin/ausschreibungen/[id])",
    invoke: () =>
      patchAdminAusschreibung(
        formDataRequest("PATCH", `/api/admin/ausschreibungen/${matrixAusschreibungId}`, {
          title: `Geänderte Matrix-Ausschreibung ${nächsteNummer()}`,
        }),
        routeContext({ id: matrixAusschreibungId })
      ),
    snapshot: async () => {
      const ausschreibung = await prisma.ausschreibung.findUniqueOrThrow({
        where: { id: matrixAusschreibungId },
      });
      return {
        title: ausschreibung.title,
        description: ausschreibung.description,
        expiresAt: ausschreibung.expiresAt.toISOString(),
      };
    },
    erfolgsStatus: 200,
  },
  {
    name: "Standorte (POST /api/admin/ranges)",
    invoke: () =>
      postAdminRanges(
        apiRequest("POST", "/api/admin/ranges", {
          body: { name: `Matrix-Standort ${nächsteNummer()}`, latitude: "48.137", longitude: "11.575" },
        })
      ),
    snapshot: () => prisma.shootingRange.count(),
    erfolgsStatus: 201,
  },
  {
    name: "Einladungen (POST /api/admin/invitations)",
    invoke: () =>
      postAdminInvitations(
        apiRequest("POST", "/api/admin/invitations", {
          body: { email: `matrix-einladung-${nächsteNummer()}@example.com` },
        })
      ),
    snapshot: () => prisma.invitation.count(),
    erfolgsStatus: 200,
  },
];

// ---------------------------------------------------------------------------
// Teil A: Rollenmatrix über die echten Routen
// ---------------------------------------------------------------------------

describe("Rollenmatrix: administrative Leserouten", () => {
  describe.each(adminGetGruppen)("$name", (gruppe) => {
    it.each([
      ["SITE_ADMINISTRATOR", 200],
      ["ADMIN", 200],
      ["AUDITOR", 200],
      ["MEMBER", 403],
    ] as const)("%s → %d", async (rolle, erwarteterStatus) => {
      loginAs(benutzerFürRolle(rolle));

      const response = await gruppe.invoke();

      expect(response.status).toBe(erwarteterStatus);
    });

    it("ohne Session → 401", async () => {
      const response = await gruppe.invoke();

      expect(response.status).toBe(401);
    });
  });
});

describe("Rollenmatrix: administrative Schreiboperationen", () => {
  describe.each(schreibGruppen)("$name", (gruppe) => {
    it.each([
      ["AUDITOR", 403],
      ["MEMBER", 403],
    ] as const)("%s → %d und die Datenbank bleibt unverändert", async (rolle, erwarteterStatus) => {
      loginAs(benutzerFürRolle(rolle));
      const vorher = await gruppe.snapshot();

      const response = await gruppe.invoke();

      expect(response.status).toBe(erwarteterStatus);
      await expect(gruppe.snapshot()).resolves.toEqual(vorher);
    });

    it("ohne Session → 401 und die Datenbank bleibt unverändert", async () => {
      const vorher = await gruppe.snapshot();

      const response = await gruppe.invoke();

      expect(response.status).toBe(401);
      await expect(gruppe.snapshot()).resolves.toEqual(vorher);
    });

    it.each([["ADMIN"], ["SITE_ADMINISTRATOR"]] as const)(
      "%s → Erfolg und die Änderung landet in der Datenbank",
      async (rolle) => {
        loginAs(benutzerFürRolle(rolle));
        const vorher = await gruppe.snapshot();

        const response = await gruppe.invoke();

        expect(response.status).toBe(gruppe.erfolgsStatus);
        await expect(gruppe.snapshot()).resolves.not.toEqual(vorher);
      }
    );
  });
});

describe("Manage-gesperrte Leserouten: Postausgang und Benachrichtigungs-Übersicht", () => {
  const gesperrteLeserouten: GetGruppe[] = [
    {
      name: "Postausgang (GET /api/admin/outgoing-emails)",
      invoke: () => getAdminOutgoingEmails(apiRequest("GET", "/api/admin/outgoing-emails")),
    },
    {
      name: "Benachrichtigungen (GET /api/admin/notifications)",
      invoke: () => getAdminNotifications(apiRequest("GET", "/api/admin/notifications")),
    },
  ];

  describe.each(gesperrteLeserouten)("$name", (gruppe) => {
    it.each([
      ["SITE_ADMINISTRATOR", 200],
      ["ADMIN", 200],
      ["AUDITOR", 403],
      ["MEMBER", 403],
    ] as const)("%s → %d", async (rolle, erwarteterStatus) => {
      loginAs(benutzerFürRolle(rolle));

      const response = await gruppe.invoke();

      expect(response.status).toBe(erwarteterStatus);
    });

    it("ohne Session → 401", async () => {
      const response = await gruppe.invoke();

      expect(response.status).toBe(401);
    });
  });
});

describe("Impersonierung (POST /api/admin/users/[id]/impersonate)", () => {
  function impersonateRequest(targetId: string) {
    return postImpersonate(
      apiRequest("POST", `/api/admin/users/${targetId}/impersonate`),
      routeContext({ id: targetId })
    );
  }

  it("SITE_ADMINISTRATOR erhält Proof und Zieldaten", async () => {
    loginAs(siteAdministrator);

    const response = await impersonateRequest(member.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      proof: unknown;
      target: { id: string; name: string | null; email: string; role: string };
    };
    expect(typeof body.proof).toBe("string");
    expect((body.proof as string).length).toBeGreaterThan(0);
    expect(body.target).toEqual({
      id: member.id,
      name: member.name,
      email: member.email,
      role: "MEMBER",
    });
  });

  it.each([["ADMIN"], ["AUDITOR"], ["MEMBER"]] as const)("%s → 403", async (rolle) => {
    loginAs(benutzerFürRolle(rolle));

    const response = await impersonateRequest(member.id);

    expect(response.status).toBe(403);
  });

  it("ohne Session → 401", async () => {
    const response = await impersonateRequest(member.id);

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Teil B: Ausschreibungs-Datumsgrenze (TZ=Europe/Berlin)
// ---------------------------------------------------------------------------

describe("Ausschreibungs-Datumsgrenze in Europe/Berlin", () => {
  // Die Grenzfälle laufen über den referenceDate-/now-Parameter der lib-Funktionen
  // mit fest konstruierten Zeitpunkten: jest.useFakeTimers ist bei better-sqlite3/
  // Prisma riskant, und ein Date.now-Spy erreicht `new Date()` im Default-Parameter
  // der Routen ohnehin nicht. Die echte Route wird deshalb zusätzlich mit relativ
  // zu „jetzt" konstruierten Datensätzen geprüft (Stichtag heute/gestern/morgen).
  describe("isAusschreibungCurrent am Stichtag (Sommerzeit, UTC+2)", () => {
    // Ablaufdatum 15.08.2026 — gespeichert als UTC-Mitternacht des Kalendertags
    const stichtag = parseIsoDateOnlyToUtcDate("2026-08-15");

    it("ist um 00:00 Europe/Berlin am Stichtag selbst aktuell", () => {
      // 15.08.2026 00:00 Berlin = 14.08.2026 22:00 UTC
      expect(isAusschreibungCurrent(stichtag, new Date("2026-08-14T22:00:00.000Z"))).toBe(true);
    });

    it("ist um 23:59 Europe/Berlin am Stichtag noch aktuell", () => {
      // 15.08.2026 23:59 Berlin = 15.08.2026 21:59 UTC
      expect(isAusschreibungCurrent(stichtag, new Date("2026-08-15T21:59:00.000Z"))).toBe(true);
    });

    it("kippt exakt um Mitternacht Europe/Berlin zum Folgetag", () => {
      // letzte Millisekunde des Stichtags: noch aktuell
      expect(isAusschreibungCurrent(stichtag, new Date("2026-08-15T21:59:59.999Z"))).toBe(true);
      // 16.08.2026 00:00 Berlin = 15.08.2026 22:00 UTC: historisch
      expect(isAusschreibungCurrent(stichtag, new Date("2026-08-15T22:00:00.000Z"))).toBe(false);
    });

    it("ist um 00:01 Europe/Berlin am Tag danach historisch", () => {
      expect(isAusschreibungCurrent(stichtag, new Date("2026-08-15T22:01:00.000Z"))).toBe(false);
    });
  });

  describe("isAusschreibungCurrent am Stichtag (Winterzeit, UTC+1)", () => {
    const stichtag = parseIsoDateOnlyToUtcDate("2026-01-20");

    it("ist um 23:59 Europe/Berlin am Stichtag noch aktuell", () => {
      // 20.01.2026 23:59 Berlin = 20.01.2026 22:59 UTC
      expect(isAusschreibungCurrent(stichtag, new Date("2026-01-20T22:59:00.000Z"))).toBe(true);
    });

    it("ist um 00:01 Europe/Berlin am Tag danach historisch", () => {
      // 21.01.2026 00:01 Berlin = 20.01.2026 23:01 UTC
      expect(isAusschreibungCurrent(stichtag, new Date("2026-01-20T23:01:00.000Z"))).toBe(false);
    });
  });

  describe("splitAndSortAusschreibungen mit fester Bezugszeit", () => {
    it("sortiert aktuelle aufsteigend und historische absteigend nach Meldeschluss", () => {
      const bezugszeit = new Date("2026-08-15T10:00:00.000Z"); // 15.08.2026 12:00 Berlin
      const createdAt = new Date("2026-08-01T08:00:00.000Z");
      const zeilen = [
        { id: "vorgestern", expiresAt: parseIsoDateOnlyToUtcDate("2026-08-13"), createdAt },
        { id: "gestern", expiresAt: parseIsoDateOnlyToUtcDate("2026-08-14"), createdAt },
        { id: "heute", expiresAt: parseIsoDateOnlyToUtcDate("2026-08-15"), createdAt },
        { id: "übermorgen", expiresAt: parseIsoDateOnlyToUtcDate("2026-08-17"), createdAt },
        { id: "morgen", expiresAt: parseIsoDateOnlyToUtcDate("2026-08-16"), createdAt },
      ];

      const { current, historical } = splitAndSortAusschreibungen(zeilen, bezugszeit);

      // Stichtag selbst zählt als aktuell, davor liegende Tage als historisch
      expect(current.map((zeile) => zeile.id)).toEqual(["heute", "morgen", "übermorgen"]);
      expect(historical.map((zeile) => zeile.id)).toEqual(["gestern", "vorgestern"]);
    });
  });

  describe("öffentliche Route GET /api/ausschreibungen (ohne Session)", () => {
    // Die Route bildet ihren Stichtag aus einem eigenen `new Date()`. Ohne feste
    // Zeit könnte zwischen Testdaten und Routenaufruf Mitternacht liegen und
    // "Meldeschluss heute" in die Historie kippen. Nur Date wird eingefroren,
    // die Timer-APIs bleiben echt (Prisma arbeitet asynchron).
    const MITTAGS_IN_BERLIN = new Date("2026-08-05T12:00:00+02:00");

    beforeEach(() => {
      jest.useFakeTimers({
        now: MITTAGS_IN_BERLIN,
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

    it("liefert den Stichtag heute als aktuell, gestern historisch — Historie bleibt abrufbar", async () => {
      const heute = heuteUtcMitternacht();
      const gestern = new Date(heute.getTime() - TAG_IN_MS);
      const morgen = new Date(heute.getTime() + TAG_IN_MS);

      const abgelaufen = await createAusschreibungRecord(gestern, "Gestern abgelaufen");
      const stichtagHeute = await createAusschreibungRecord(heute, "Meldeschluss heute");
      const läuftNoch = await createAusschreibungRecord(morgen, "Meldeschluss morgen");

      // kein loginAs: die öffentliche Liste ist ohne Session erreichbar
      const response = await getPublicAusschreibungen();

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        current: { id: string; expiresAt: string }[];
        historical: { id: string; expiresAt: string }[];
      };

      const aktuelleIds = body.current.map((eintrag) => eintrag.id);
      const historischeIds = body.historical.map((eintrag) => eintrag.id);

      // Stichtag heute ist bis einschließlich Ablaufdatum aktuell
      expect(aktuelleIds).toContain(stichtagHeute.id);
      expect(aktuelleIds).toContain(läuftNoch.id);
      expect(aktuelleIds).not.toContain(abgelaufen.id);

      // ab dem Tag danach historisch — und dort weiterhin abrufbar
      expect(historischeIds).toContain(abgelaufen.id);
      expect(historischeIds).not.toContain(stichtagHeute.id);
      expect(historischeIds).not.toContain(läuftNoch.id);

      // aktuelle Liste ist nach nächstem Meldeschluss zuerst sortiert
      expect(aktuelleIds.indexOf(stichtagHeute.id)).toBeLessThan(aktuelleIds.indexOf(läuftNoch.id));
    });
  });
});

import type { Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getFeed } from "@/app/kalender.ics/route";
import { createEvent, createUser } from "./helpers/factories";

const NOW = new Date("2026-10-19T12:00:00+02:00");
const LEVELS: Visibility[] = ["PUBLIC", "MEMBER", "HIDDEN"];

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

function createTermin(title: string, date: string, visibility: Visibility = "PUBLIC") {
  return createEvent({ date: localDate(date, 18), timeFrom: "18:00", timeTo: "20:00", title, visibility });
}

function createFremdtermin(title: string, startDate: string, endDate: string, visibility: Visibility = "PUBLIC") {
  return prisma.externalEvent.create({
    data: { title, startDate: localDate(startDate), endDate: localDate(endDate), visibility },
  });
}

async function fetchFeed() {
  const response = await getFeed();
  return { response, body: await response.text() };
}

function summaries(ics: string): string[] {
  return ics
    .replace(/\r\n /g, "")
    .split("\r\n")
    .filter((line) => line.startsWith("SUMMARY:"))
    .map((line) => line.slice("SUMMARY:".length));
}

beforeAll(async () => {
  for (const visibility of LEVELS) {
    await createTermin(`Termin ${visibility}`, "2026-11-10", visibility);
    await createFremdtermin(`Fremdtermin ${visibility}`, "2026-11-14", "2026-11-15", visibility);
  }
  await createTermin("Termin zu alt", "2026-07-20");
  await createTermin("Termin erster Tag", "2026-07-21");
  await createTermin("Termin letzter Tag", "2027-10-19");
  await createTermin("Termin zu weit", "2027-10-20");
  await createFremdtermin("Fremdtermin zu alt", "2026-07-10", "2026-07-20");
  await createFremdtermin("Fremdtermin überlappend", "2026-07-15", "2026-07-22");
  await createFremdtermin("Fremdtermin zu weit", "2027-10-20", "2027-10-21");

  const member = await createUser({ name: "Erika Beispiel" });
  await prisma.absence.create({
    data: { userId: member.id, startDate: localDate("2026-11-03"), endDate: localDate("2026-11-04"), reason: "Urlaub" },
  });
});

describe("GET /kalender.ics", () => {
  it("responds with a public, cacheable iCalendar file", async () => {
    const { response } = await fetchFeed();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="kalender.ics"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=300, stale-while-revalidate=300");
    expect(response.headers.get("vary")).toBeNull();
  });

  it("contains only PUBLIC Termine and Fremdtermine within the window", async () => {
    const { body } = await fetchFeed();

    expect(summaries(body).sort()).toEqual(
      [
        "Fremdtermin PUBLIC",
        "Fremdtermin überlappend",
        "Termin PUBLIC",
        "Termin erster Tag",
        "Termin letzter Tag",
      ].sort()
    );
    expect(body).not.toMatch(/MEMBER|HIDDEN|zu alt|zu weit/);
  });

  it("never contains Abwesenheiten or personal data", async () => {
    const { body } = await fetchFeed();

    expect(body).not.toContain("Urlaub");
    expect(body).not.toContain("Erika");
    expect(body).not.toContain("Abwesen");
  });

  it("has a balanced, well-formed structure", async () => {
    const { body } = await fetchFeed();
    const lines = body.split("\r\n");

    expect(body.endsWith("\r\n")).toBe(true);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    const stack: string[] = [];
    for (const line of lines) {
      if (line.startsWith("BEGIN:")) stack.push(line.slice(6));
      if (line.startsWith("END:")) expect(stack.pop()).toBe(line.slice(4));
    }
    expect(stack).toEqual([]);
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(5);
    lines.forEach((line) => expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75));
  });
});

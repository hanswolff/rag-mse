import { buildCalendarFeed, CALENDAR_FEED_MAX_DESCRIPTION_CHARS, foldIcsLine, type FeedFremdtermin, type FeedTermin } from "@/lib/calendar";
import { buildEventDateTime } from "@/lib/dates";

const NOW = new Date("2026-10-19T10:00:00Z");
const BASE_URL = "https://rag-mse.de/";

function termin(overrides: Partial<FeedTermin> = {}): FeedTermin {
  return {
    id: "t1",
    date: "2026-11-10",
    timeFrom: "18:00",
    timeTo: "20:00",
    title: "Vereinstraining",
    type: "Training",
    location: "Schießstand",
    description: "",
    updatedAt: new Date("2026-10-01T08:30:00Z"),
    ...overrides,
  };
}

function fremdtermin(overrides: Partial<FeedFremdtermin> = {}): FeedFremdtermin {
  return {
    id: "f1",
    title: "Landesmeisterschaft",
    startDate: "2026-11-14",
    endDate: "2026-11-15",
    allDay: true,
    timeFrom: null,
    timeTo: null,
    location: null,
    description: null,
    url: null,
    kind: null,
    updatedAt: new Date("2026-10-02T09:00:00Z"),
    ...overrides,
  };
}

function feed(termine: FeedTermin[] = [], fremdtermine: FeedFremdtermin[] = []) {
  return buildCalendarFeed({ termine, fremdtermine, baseUrl: BASE_URL, now: NOW });
}

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

function property(ics: string, name: string): string[] {
  return unfold(ics)
    .filter((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`))
    .map((line) => line.slice(line.indexOf(":") + 1));
}

describe("buildCalendarFeed", () => {
  it("builds a calendar with header and one VEVENT per entry", () => {
    const ics = feed([termin()], [fremdtermin()]);
    const lines = unfold(ics);

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines.filter((line) => line === "END:VEVENT")).toHaveLength(2);
    expect(property(ics, "X-WR-CALNAME")).toEqual(["RAG Schießsport MSE – Kalender"]);
    expect(property(ics, "X-WR-TIMEZONE")).toEqual(["Europe/Berlin"]);
    expect(lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(lines).toContain("X-PUBLISHED-TTL:PT6H");
  });

  it("uses stable UIDs, DTSTAMP and LAST-MODIFIED", () => {
    const first = feed([termin()], [fremdtermin()]);
    const second = buildCalendarFeed({ termine: [termin()], fremdtermine: [fremdtermin()], baseUrl: BASE_URL, now: new Date() });

    expect(property(first, "UID")).toEqual(["termin-t1@rag-mse.de", "fremdtermin-f1@rag-mse.de"]);
    expect(property(second, "UID")).toEqual(property(first, "UID"));
    expect(property(first, "DTSTAMP")).toEqual(["20261019T100000Z", "20261019T100000Z"]);
    expect(property(first, "LAST-MODIFIED")).toEqual(["20261001T083000Z", "20261002T090000Z"]);
  });

  it("emits timed Termine in UTC across the DST changes", () => {
    const ics = feed([
      termin({ id: "summer", date: "2026-10-24", timeFrom: "18:00", timeTo: "20:00" }),
      termin({ id: "winter", date: "2026-10-25", timeFrom: "18:00", timeTo: "20:00" }),
      termin({ id: "before", date: "2027-03-27", timeFrom: "09:00", timeTo: "10:30" }),
      termin({ id: "after", date: "2027-03-28", timeFrom: "09:00", timeTo: "10:30" }),
    ]);

    expect(property(ics, "DTSTART")).toEqual(["20261024T160000Z", "20261025T170000Z", "20270327T080000Z", "20270328T070000Z"]);
    expect(property(ics, "DTEND")).toEqual(["20261024T180000Z", "20261025T190000Z", "20270327T093000Z", "20270328T083000Z"]);
  });

  it("maps a nonexistent spring-forward time like buildEventDateTime does", () => {
    const ics = feed([termin({ date: "2027-03-28", timeFrom: "02:30", timeTo: "04:00" })]);
    const reminderStart = buildEventDateTime(new Date(2027, 2, 28), "02:30");

    expect(reminderStart.toISOString()).toBe("2027-03-28T00:30:00.000Z");
    expect(property(ics, "DTSTART")).toEqual(["20270328T003000Z"]);
    expect(property(ics, "DTEND")).toEqual(["20270328T020000Z"]);
  });

  it("falls back to one hour when a Termin has no valid end time", () => {
    const ics = feed([termin({ timeFrom: "18:00", timeTo: "" }), termin({ id: "t2", timeFrom: "18:00", timeTo: "17:00" })]);

    expect(property(ics, "DTEND")).toEqual(["20261110T180000Z", "20261110T180000Z"]);
  });

  it("emits all-day Fremdtermine with exclusive DTEND", () => {
    const ics = feed([], [fremdtermin({ startDate: "2026-12-31", endDate: "2026-12-31" }), fremdtermin({ id: "f2" })]);
    const lines = unfold(ics);

    expect(lines).toContain("DTSTART;VALUE=DATE:20261231");
    expect(lines).toContain("DTEND;VALUE=DATE:20270101");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261114");
    expect(lines).toContain("DTEND;VALUE=DATE:20261116");
  });

  it("spans timed multi-day Fremdtermine from start time to end time", () => {
    const ics = feed([], [fremdtermin({ allDay: false, startDate: "2026-10-24", endDate: "2026-10-26", timeFrom: "08:00", timeTo: "16:00" })]);

    expect(property(ics, "DTSTART")).toEqual(["20261024T060000Z"]);
    expect(property(ics, "DTEND")).toEqual(["20261026T150000Z"]);
  });

  it("builds summaries, URLs and locations", () => {
    const ics = feed(
      [termin({ title: null, type: "Training" }), termin({ id: "t2", title: null, type: null })],
      [
        fremdtermin({ kind: "COMPETITION", url: "https://example.com/lm", location: "Kaserne" }),
        fremdtermin({ id: "f2", title: "RDL Schießausbildung", kind: "RDL", url: "javascript:alert(1)" }),
        fremdtermin({ id: "f3", title: "Grillfest", kind: "OTHER" }),
      ]
    );

    expect(property(ics, "SUMMARY")).toEqual(["Training", "Termin", "Wettkampf: Landesmeisterschaft", "RDL Schießausbildung", "Grillfest"]);
    expect(property(ics, "URL")).toEqual([
      "https://rag-mse.de/termine/t1",
      "https://rag-mse.de/termine/t2",
      "https://example.com/lm",
      "https://rag-mse.de/kalender",
      "https://rag-mse.de/kalender",
    ]);
    expect(property(ics, "LOCATION")).toEqual(["Schießstand", "Schießstand", "Kaserne"]);
  });

  it("escapes comma, semicolon, backslash and newlines", () => {
    const ics = feed([], [fremdtermin({ title: "A, B; C\\D", description: "Zeile 1\nZeile 2\r\nZeile 3" })]);

    expect(property(ics, "SUMMARY")).toEqual(["A\\, B\\; C\\\\D"]);
    expect(property(ics, "DESCRIPTION")).toEqual(["Zeile 1\\nZeile 2\\nZeile 3"]);
  });

  it("normalizes bare carriage returns", () => {
    const ics = feed([], [fremdtermin({ title: "Teil 1\rTeil 2", description: "A\rB\r\rC" })]);

    expect(ics.replace(/\r\n/g, "")).not.toContain("\r");
    expect(property(ics, "SUMMARY")).toEqual(["Teil 1\\nTeil 2"]);
    expect(property(ics, "DESCRIPTION")).toEqual(["A\\nB\\n\\nC"]);
  });

  it("truncates long descriptions and keeps the URL", () => {
    const long = "x".repeat(CALENDAR_FEED_MAX_DESCRIPTION_CHARS + 500);
    const ics = feed([termin({ description: `<p>${long}</p>` })], [fremdtermin({ description: long })]);
    const descriptions = property(ics, "DESCRIPTION");

    expect(descriptions).toHaveLength(2);
    descriptions.forEach((description) => {
      expect([...description]).toHaveLength(CALENDAR_FEED_MAX_DESCRIPTION_CHARS);
      expect(description.endsWith("…")).toBe(true);
    });
    expect(property(ics, "URL")).toEqual(["https://rag-mse.de/termine/t1", "https://rag-mse.de/kalender"]);
  });

  it("strips HTML from Termin descriptions", () => {
    const ics = feed([
      termin({ description: '<p>Bitte <strong>pünktlich</strong> &amp; mit Ausweis</p><p>Infos: <a href="https://x.de">Link</a></p><script>alert(1)</script>' }),
    ]);

    expect(property(ics, "DESCRIPTION")).toEqual(["Bitte pünktlich & mit Ausweis\\nInfos: Link"]);
  });
});

describe("foldIcsLine", () => {
  const octets = (value: string) => new TextEncoder().encode(value).length;

  it("keeps short lines unchanged", () => {
    expect(foldIcsLine("SUMMARY:kurz")).toBe("SUMMARY:kurz");
  });

  it.each([
    ["ASCII", "x".repeat(200)],
    ["Umlaute", "ä".repeat(120)],
    ["Emoji", "🎯".repeat(60)],
    ["gemischt", `a${"ö🎯".repeat(40)}`],
  ])("folds %s at 75 octets without splitting characters", (_name, text) => {
    const line = `DESCRIPTION:${text}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");

    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part, index) => {
      expect(octets(part)).toBeLessThanOrEqual(75);
      if (index > 0) expect(part.startsWith(" ")).toBe(true);
    });
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    expect(parts.join("")).not.toContain("�");
  });

  it("folds long feed lines", () => {
    const ics = feed([], [fremdtermin({ description: "Ä".repeat(100) })]);

    ics.split("\r\n").forEach((line) => expect(octets(line)).toBeLessThanOrEqual(75));
    expect(property(ics, "DESCRIPTION")).toEqual(["Ä".repeat(100)]);
  });
});

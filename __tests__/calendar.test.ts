import { buildCalendarEvent } from "@/lib/calendar";

describe("calendar", () => {
  it("folds long lines and normalizes bare carriage returns in the attachment", () => {
    const ics = buildCalendarEvent({
      uid: "event-2@rag-mse",
      title: "Lehrgang",
      description: "Zeile 1\rZeile 2",
      location: "Schießsportanlage Neubrandenburg, Am Schießstand 12, 17033 Neubrandenburg, Eingang Nord",
      start: new Date(2026, 1, 20, 18, 0, 0),
      end: new Date(2026, 1, 20, 20, 0, 0),
    });

    const lines = ics.split("\r\n");
    expect(lines.every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
    expect(ics.replace(/\r\n /g, "")).toContain("Eingang Nord");
    expect(ics).toContain("DESCRIPTION:Zeile 1\\nZeile 2");
  });

  it("builds a valid ICS event payload", () => {
    const start = new Date(2026, 1, 20, 18, 0, 0);
    const end = new Date(2026, 1, 20, 20, 0, 0);

    const ics = buildCalendarEvent({
      uid: "event-1@rag-mse",
      title: "RAG Termin",
      description: "Bitte teilnehmen",
      location: "Ulm",
      start,
      end,
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:event-1@rag-mse");
    expect(ics).toContain("SUMMARY:RAG Termin");
    expect(ics).toContain("LOCATION:Ulm");
    expect(ics).toContain("DTSTART:20260220T180000");
    expect(ics).toContain("DTEND:20260220T200000");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});

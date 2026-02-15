import { buildCalendarEvent } from "@/lib/calendar";

describe("calendar", () => {
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

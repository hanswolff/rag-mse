import { splitExternalEventsByDate } from "@/lib/external-event-list";
import { formatPeriod } from "@/lib/dates";
import type { ExternalEventItem } from "@/types";

function item(id: string, startDate: string, endDate: string): ExternalEventItem {
  return {
    id,
    title: id,
    startDate,
    endDate,
    allDay: true,
    timeFrom: null,
    timeTo: null,
    location: null,
    description: null,
    url: null,
    kind: null,
    visibility: "MEMBER",
    ausschreibungId: null,
    ausschreibung: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("Fremdtermin-Liste", () => {
  it("zeigt kommende aufsteigend zuerst, vergangene absteigend darunter; laufende zählen als kommend", () => {
    const { upcoming, past } = splitExternalEventsByDate(
      [
        item("alt", "2026-09-01", "2026-09-02"),
        item("später", "2026-12-01", "2026-12-01"),
        item("laufend", "2026-10-18", "2026-10-20"),
        item("jünger", "2026-10-10", "2026-10-18"),
      ],
      "2026-10-19"
    );
    expect(upcoming.map((e) => e.id)).toEqual(["laufend", "später"]);
    expect(past.map((e) => e.id)).toEqual(["jünger", "alt"]);
  });

  it("formatiert ganztägige und zeitgebundene Zeiträume", () => {
    expect(formatPeriod(item("a", "2026-11-06", "2026-11-06"))).toBe("06.11.2026");
    expect(formatPeriod(item("a", "2026-11-06", "2026-11-08"))).toBe("06.11.2026 – 08.11.2026");
    expect(formatPeriod({ ...item("a", "2026-11-06", "2026-11-06"), allDay: false, timeFrom: "09:00", timeTo: "17:00" }))
      .toBe("06.11.2026, 09:00–17:00 Uhr");
    expect(formatPeriod({ ...item("a", "2026-11-06", "2026-11-07"), allDay: false, timeFrom: "18:00", timeTo: "08:00" }))
      .toBe("06.11.2026, 18:00 Uhr – 07.11.2026, 08:00 Uhr");
  });
});

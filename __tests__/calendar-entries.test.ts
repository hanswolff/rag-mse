import { addDaysToIsoDate } from "@/lib/dates";
import { getTerminTitle } from "@/lib/event-types";
import {
  aggregateAbsencesPerDay,
  buildCalendarEvents,
  DEFAULT_CALENDAR_FILTERS,
  describeAbsenceOnDay,
  getSlotRange,
  periodToEventTimes,
} from "@/lib/calendar-entries";
import {
  buildCalendarSearch,
  CALENDAR_FILTER_STORAGE_KEY,
  loadCalendarFilters,
  parseDateParam,
  parseViewParam,
  resolveInitialView,
  saveCalendarFilters,
  toCalendarRange,
  viewParamFor,
  selectionToPeriod,
} from "@/lib/calendar-view-state";
import type { CalendarAbsence, CalendarData } from "@/lib/calendar-service";

const RANGE = { from: "2026-11-01", to: "2026-11-30" };

function absence(overrides: Partial<CalendarAbsence>): CalendarAbsence {
  return {
    id: "a",
    startDate: "2026-11-03",
    endDate: "2026-11-03",
    allDay: true,
    timeFrom: null,
    timeTo: null,
    reason: null,
    userName: "Erika Beispiel",
    isOwn: false,
    ...overrides,
  };
}

const DATA: CalendarData = {
  termine: [
    { id: "t1", date: "2026-11-10", timeFrom: "18:00", timeTo: "20:00", title: null, type: "Training", location: "Stand" },
  ],
  fremdtermine: [
    {
      id: "f1",
      title: "RDL",
      startDate: "2026-11-14",
      endDate: "2026-11-15",
      allDay: true,
      timeFrom: null,
      timeTo: null,
      location: null,
      description: null,
      url: null,
      kind: "RDL",
      ausschreibung: null,
    },
  ],
  abwesenheiten: [
    absence({ id: "own", isOwn: true, reason: "Urlaub", startDate: "2026-11-03", endDate: "2026-11-04" }),
    absence({ id: "o1", startDate: "2026-11-03", endDate: "2026-11-05" }),
    absence({ id: "o2", startDate: "2026-11-05", endDate: "2026-11-05", userName: "Max Muster" }),
  ],
};

describe("Kalender-Einträge", () => {
  it("rechnet mit ISO-Daten über Monats- und Jahresgrenzen", () => {
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("setzt das Ende ganztägiger Zeiträume exklusiv einen Tag später", () => {
    expect(periodToEventTimes({ startDate: "2026-11-14", endDate: "2026-11-15", allDay: true, timeFrom: null, timeTo: null }))
      .toEqual({ start: "2026-11-14", end: "2026-11-16", allDay: true });
    expect(periodToEventTimes({ startDate: "2026-11-14", endDate: "2026-11-15", allDay: false, timeFrom: "08:00", timeTo: "17:00" }))
      .toEqual({ start: "2026-11-14T08:00", end: "2026-11-15T17:00", allDay: false });
  });

  it("zählt mehrtägige fremde Abwesenheiten an jedem berührten Tag, begrenzt auf den Zeitraum", () => {
    const days = aggregateAbsencesPerDay(
      [absence({ id: "lang", startDate: "2026-10-30", endDate: "2026-11-02" }), absence({ id: "kurz", startDate: "2026-11-02" , endDate: "2026-11-02" })],
      RANGE
    );
    expect(days.map((day) => [day.date, day.absences.map((entry) => entry.id)])).toEqual([
      ["2026-11-01", ["lang"]],
      ["2026-11-02", ["lang", "kurz"]],
    ]);
  });

  it("sammelt viele überlappende Abwesenheiten je Tag vollständig und in Eingabereihenfolge", () => {
    const many = Array.from({ length: 300 }, (_, index) =>
      absence({ id: `a${index}`, startDate: "2026-10-01", endDate: "2026-12-31" })
    );
    const days = aggregateAbsencesPerDay(many, RANGE);
    expect(days).toHaveLength(30);
    expect(days.every((day) => day.absences.length === 300)).toBe(true);
    expect(days[0].absences.map((entry) => entry.id)).toEqual(many.map((entry) => entry.id));
  });

  it("beschreibt die Zeit einer Abwesenheit je Tag", () => {
    const timed = { startDate: "2026-11-03", endDate: "2026-11-05", allDay: false, timeFrom: "08:00", timeTo: "12:00" };
    expect(describeAbsenceOnDay(timed, "2026-11-03")).toBe("ab 08:00 Uhr");
    expect(describeAbsenceOnDay(timed, "2026-11-04")).toBe("ganztägig");
    expect(describeAbsenceOnDay(timed, "2026-11-05")).toBe("bis 12:00 Uhr");
    expect(describeAbsenceOnDay({ ...timed, endDate: "2026-11-03" }, "2026-11-03")).toBe("08:00–12:00 Uhr");
    expect(describeAbsenceOnDay({ ...timed, allDay: true }, "2026-11-03")).toBe("ganztägig");
  });

  it("benennt Termine nach Titel, sonst nach Terminart", () => {
    expect(getTerminTitle({ title: "Vereinsabend", type: "Training" })).toBe("Vereinsabend");
    expect(getTerminTitle({ title: null, type: "Training" })).toBe("Training");
    expect(getTerminTitle({ title: null, type: null })).toBe("Termin");
  });

  it("baut FullCalendar-Einträge: Termin mit Link, eigene Abwesenheit einzeln, fremde gesammelt", () => {
    const events = buildCalendarEvents(DATA, RANGE, DEFAULT_CALENDAR_FILTERS);
    expect(events.map((event) => [event.id, event.title])).toEqual([
      ["termin-t1", "Training"],
      ["fremdtermin-f1", "RDL"],
      ["abwesenheit-own", "Abwesend: Urlaub"],
      ["abwesenheiten-2026-11-03", "1 abwesend"],
      ["abwesenheiten-2026-11-04", "1 abwesend"],
      ["abwesenheiten-2026-11-05", "2 abwesend"],
    ]);
    expect(events[0]).toMatchObject({ url: "/termine/t1", start: "2026-11-10T18:00", end: "2026-11-10T20:00", allDay: false });
    expect(events[1]).toMatchObject({ end: "2026-11-16", classNames: ["calendar-entry", "calendar-entry-fremdtermin"] });
    expect(events[2]).toMatchObject({ start: "2026-11-03", end: "2026-11-05", allDay: true });
  });

  it("zeigt in der Wochenansicht 07–22 Uhr und erweitert auf frühere oder spätere Einträge", () => {
    expect(getSlotRange([])).toEqual({ slotMinTime: "07:00", slotMaxTime: "22:00" });
    expect(getSlotRange([
      { start: "2026-11-10T06:30", end: "2026-11-10T08:00", allDay: false },
      { start: "2026-11-11T20:00", end: "2026-11-11T23:15", allDay: false },
      { start: "2026-11-12", end: "2026-11-13", allDay: true },
    ])).toEqual({ slotMinTime: "06:00", slotMaxTime: "24:00" });
    expect(getSlotRange([{ start: "2026-11-10T08:00", end: "2026-11-11T17:00", allDay: false }]))
      .toEqual({ slotMinTime: "00:00", slotMaxTime: "24:00" });
  });

  it("blendet Eintragsarten über die Filter aus", () => {
    const events = buildCalendarEvents(DATA, RANGE, { termine: false, fremdtermine: true, abwesenheiten: false });
    expect(events.map((event) => event.id)).toEqual(["fremdtermin-f1"]);
  });
});

describe("Kalender-Ansichtszustand", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("liest Ansicht und Datum aus der URL, ungültige Werte fallen weg", () => {
    expect(parseViewParam("woche")).toBe("woche");
    expect(parseViewParam("jahr")).toBeNull();
    expect(parseDateParam("2026-11-15")).toBe("2026-11-15");
    expect(parseDateParam("2026-02-30")).toBeNull();
    expect(parseDateParam("15.11.2026")).toBeNull();
    expect(parseDateParam(null)).toBeNull();
  });

  it("nimmt unter 768 px ohne Parameter die Liste, sonst den Monat", () => {
    expect(resolveInitialView(null, 500)).toBe("liste");
    expect(resolveInitialView(null, 1024)).toBe("monat");
    expect(resolveInitialView("woche", 500)).toBe("woche");
    expect(resolveInitialView("quatsch", 767)).toBe("liste");
  });

  it("übersetzt FullCalendar-Ansichten und Zeiträume", () => {
    expect(viewParamFor("timeGridWeek")).toBe("woche");
    expect(viewParamFor("listMonth")).toBe("liste");
    expect(viewParamFor("unbekannt")).toBe("monat");
    expect(buildCalendarSearch("woche", "2026-11-09")).toBe("ansicht=woche&datum=2026-11-09");
    expect(toCalendarRange(new Date(2026, 9, 26), new Date(2026, 11, 7))).toEqual({ from: "2026-10-26", to: "2026-12-06" });
  });

  it("merkt sich Filter und ergänzt fehlende Werte", () => {
    saveCalendarFilters({ termine: false, fremdtermine: true, abwesenheiten: true });
    expect(loadCalendarFilters()).toEqual({ termine: false, fremdtermine: true, abwesenheiten: true });

    window.localStorage.setItem(CALENDAR_FILTER_STORAGE_KEY, JSON.stringify({ fremdtermine: false, termine: "nein" }));
    expect(loadCalendarFilters()).toEqual({ termine: true, fremdtermine: false, abwesenheiten: true });

    window.localStorage.setItem(CALENDAR_FILTER_STORAGE_KEY, "{kaputt");
    expect(loadCalendarFilters()).toEqual(DEFAULT_CALENDAR_FILTERS);
  });

  it("funktioniert, wenn der Speicher Fehler wirft", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadCalendarFilters()).toEqual(DEFAULT_CALENDAR_FILTERS);
    expect(() => saveCalendarFilters(DEFAULT_CALENDAR_FILTERS)).not.toThrow();
  });
});

describe("Kalender-Auswahl", () => {
  it("wandelt das exklusive Ende einer Tagesauswahl in ein inklusives Bis um", () => {
    expect(selectionToPeriod(new Date(2026, 10, 6), new Date(2026, 10, 9), true)).toEqual({
      startDate: "2026-11-06",
      endDate: "2026-11-08",
      allDay: true,
      timeFrom: "",
      timeTo: "",
    });
    expect(selectionToPeriod(new Date(2026, 9, 25), new Date(2026, 9, 26), true)).toMatchObject({
      startDate: "2026-10-25",
      endDate: "2026-10-25",
    });
  });

  it("übernimmt bei einer Zeitauswahl die Berliner Ortszeit", () => {
    expect(selectionToPeriod(new Date("2026-11-10T08:30:00Z"), new Date("2026-11-10T10:00:00Z"), false)).toEqual({
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      allDay: false,
      timeFrom: "09:30",
      timeTo: "11:00",
    });
  });

  it("endet eine Zeitauswahl bis Mitternacht am selben Tag um 23:59", () => {
    expect(selectionToPeriod(new Date(2026, 10, 10, 22, 0), new Date(2026, 10, 11, 0, 0), false)).toMatchObject({
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      timeFrom: "22:00",
      timeTo: "23:59",
    });
  });
});

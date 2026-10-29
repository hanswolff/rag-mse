import type { EventInput } from "@fullcalendar/core";
import { addDaysToIsoDate } from "@/lib/dates";
import { getTerminTitle } from "@/lib/event-types";
import type {
  CalendarAbsence,
  CalendarData,
  CalendarFremdtermin,
  CalendarRange,
  CalendarTermin,
} from "@/lib/calendar-service";

export type CalendarEntry =
  | { kind: "termin"; termin: CalendarTermin }
  | { kind: "fremdtermin"; fremdtermin: CalendarFremdtermin }
  | { kind: "abwesenheit"; absence: CalendarAbsence }
  | { kind: "abwesenheiten"; date: string; absences: CalendarAbsence[] };

export interface CalendarFilters {
  termine: boolean;
  fremdtermine: boolean;
  abwesenheiten: boolean;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = { termine: true, fremdtermine: true, abwesenheiten: true };

type Period = Pick<CalendarFremdtermin, "startDate" | "endDate" | "allDay" | "timeFrom" | "timeTo">;

export function periodToEventTimes({ startDate, endDate, allDay, timeFrom, timeTo }: Period) {
  if (allDay || !timeFrom || !timeTo) {
    return { start: startDate, end: addDaysToIsoDate(endDate, 1), allDay: true };
  }
  return { start: `${startDate}T${timeFrom}`, end: `${endDate}T${timeTo}`, allDay: false };
}

export function getOwnAbsenceTitle(absence: Pick<CalendarAbsence, "reason">): string {
  return absence.reason ? `Abwesend: ${absence.reason}` : "Abwesend";
}

export function aggregateAbsencesPerDay(absences: CalendarAbsence[], range: CalendarRange) {
  const byDay = new Map<string, CalendarAbsence[]>();
  for (const absence of absences) {
    const first = absence.startDate > range.from ? absence.startDate : range.from;
    const last = absence.endDate < range.to ? absence.endDate : range.to;
    for (let day = first; day <= last; day = addDaysToIsoDate(day, 1)) {
      const dayAbsences = byDay.get(day);
      if (dayAbsences) dayAbsences.push(absence);
      else byDay.set(day, [absence]);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayAbsences]) => ({ date, absences: dayAbsences }));
}

export function describeAbsenceOnDay(absence: Period, date: string): string {
  if (absence.allDay || !absence.timeFrom || !absence.timeTo) return "ganztägig";
  const startsToday = absence.startDate === date;
  const endsToday = absence.endDate === date;
  if (startsToday && endsToday) return `${absence.timeFrom}–${absence.timeTo} Uhr`;
  if (startsToday) return `ab ${absence.timeFrom} Uhr`;
  if (endsToday) return `bis ${absence.timeTo} Uhr`;
  return "ganztägig";
}

function toEvent(id: string, entry: CalendarEntry, title: string, times: Omit<EventInput, "id">, url?: string): EventInput {
  return {
    id,
    title,
    ...times,
    ...(url ? { url } : {}),
    classNames: ["calendar-entry", `calendar-entry-${entry.kind}`],
    extendedProps: { entry },
  };
}

export function buildCalendarEvents(
  data: CalendarData,
  range: CalendarRange,
  filters: CalendarFilters
): EventInput[] {
  const events: EventInput[] = [];

  if (filters.termine) {
    for (const termin of data.termine) {
      events.push(
        toEvent(
          `termin-${termin.id}`,
          { kind: "termin", termin },
          getTerminTitle(termin),
          { start: `${termin.date}T${termin.timeFrom}`, end: `${termin.date}T${termin.timeTo}`, allDay: false },
          `/termine/${termin.id}`
        )
      );
    }
  }

  if (filters.fremdtermine) {
    for (const fremdtermin of data.fremdtermine) {
      events.push(
        toEvent(`fremdtermin-${fremdtermin.id}`, { kind: "fremdtermin", fremdtermin }, fremdtermin.title, periodToEventTimes(fremdtermin))
      );
    }
  }

  if (filters.abwesenheiten) {
    const own = data.abwesenheiten.filter((absence) => absence.isOwn);
    const others = data.abwesenheiten.filter((absence) => !absence.isOwn);
    for (const absence of own) {
      events.push(
        toEvent(`abwesenheit-${absence.id}`, { kind: "abwesenheit", absence }, getOwnAbsenceTitle(absence), periodToEventTimes(absence))
      );
    }
    for (const day of aggregateAbsencesPerDay(others, range)) {
      events.push(
        toEvent(
          `abwesenheiten-${day.date}`,
          { kind: "abwesenheiten", ...day },
          `${day.absences.length} abwesend`,
          { start: day.date, allDay: true }
        )
      );
    }
  }

  return events;
}

const DEFAULT_SLOT_RANGE = { slotMinTime: "07:00", slotMaxTime: "22:00" };
const FULL_DAY_SLOT_RANGE = { slotMinTime: "00:00", slotMaxTime: "24:00" };

function toHour(hours: number): string {
  return `${String(hours).padStart(2, "0")}:00`;
}

export function getSlotRange(events: EventInput[]): { slotMinTime: string; slotMaxTime: string } {
  let { slotMinTime, slotMaxTime } = DEFAULT_SLOT_RANGE;
  for (const event of events) {
    if (event.allDay || typeof event.start !== "string" || typeof event.end !== "string") continue;
    const [startDate, startTime] = event.start.split("T");
    const [endDate, endTime] = event.end.split("T");
    if (startDate !== endDate) return FULL_DAY_SLOT_RANGE;
    const startHour = toHour(Number(startTime.slice(0, 2)));
    const endHour = toHour(Number(endTime.slice(0, 2)) + (endTime.slice(3, 5) === "00" ? 0 : 1));
    if (startHour < slotMinTime) slotMinTime = startHour;
    if (endHour > slotMaxTime) slotMaxTime = endHour;
  }
  return { slotMinTime, slotMaxTime };
}

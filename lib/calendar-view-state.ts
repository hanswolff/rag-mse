import { DEFAULT_CALENDAR_FILTERS, type CalendarFilters } from "@/lib/calendar-entries";
import { addDaysToIsoDate } from "@/lib/dates";
import { getLocalDateString, parseStrictIsoDate } from "@/lib/date-picker-utils";
import type { CalendarRange } from "@/lib/calendar-service";

export const CALENDAR_VIEWS = {
  monat: "dayGridMonth",
  woche: "timeGridWeek",
  liste: "listMonth",
} as const;

export type CalendarViewParam = keyof typeof CALENDAR_VIEWS;

export const MOBILE_BREAKPOINT_PX = 768;
export const CALENDAR_FILTER_STORAGE_KEY = "kalender-filter";

const VIEW_PARAMS = Object.keys(CALENDAR_VIEWS) as CalendarViewParam[];

export function parseViewParam(value: string | null | undefined): CalendarViewParam | null {
  return VIEW_PARAMS.find((param) => param === value) ?? null;
}

export function parseDateParam(value: string | null | undefined): string | null {
  return parseStrictIsoDate(value) ? (value as string) : null;
}

export function resolveInitialView(param: string | null | undefined, viewportWidth: number): CalendarViewParam {
  return parseViewParam(param) ?? (viewportWidth < MOBILE_BREAKPOINT_PX ? "liste" : "monat");
}

export function viewParamFor(viewType: string): CalendarViewParam {
  return VIEW_PARAMS.find((param) => CALENDAR_VIEWS[param] === viewType) ?? "monat";
}

export function buildCalendarSearch(view: CalendarViewParam, date: string): string {
  return new URLSearchParams({ ansicht: view, datum: date }).toString();
}

export function toCalendarRange(start: Date, endExclusive: Date): CalendarRange {
  return { from: getLocalDateString(start), to: addDaysToIsoDate(getLocalDateString(endExclusive), -1) };
}

export interface CalendarSelection {
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string;
  timeTo: string;
}

function getLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function selectionToPeriod(start: Date, endExclusive: Date, allDay: boolean): CalendarSelection {
  if (allDay) {
    const { from, to } = toCalendarRange(start, endExclusive);
    return { startDate: from, endDate: to, allDay: true, timeFrom: "", timeTo: "" };
  }
  const endsAtMidnight = endExclusive.getHours() === 0 && endExclusive.getMinutes() === 0;
  return {
    startDate: getLocalDateString(start),
    endDate: endsAtMidnight ? addDaysToIsoDate(getLocalDateString(endExclusive), -1) : getLocalDateString(endExclusive),
    allDay: false,
    timeFrom: getLocalTimeString(start),
    timeTo: endsAtMidnight ? "23:59" : getLocalTimeString(endExclusive),
  };
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadCalendarFilters(): CalendarFilters {
  try {
    const stored = JSON.parse(getStorage()?.getItem(CALENDAR_FILTER_STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULT_CALENDAR_FILTERS;
    const pick = (key: keyof CalendarFilters) =>
      typeof stored[key] === "boolean" ? stored[key] : DEFAULT_CALENDAR_FILTERS[key];
    return { termine: pick("termine"), fremdtermine: pick("fremdtermine"), abwesenheiten: pick("abwesenheiten") };
  } catch {
    return DEFAULT_CALENDAR_FILTERS;
  }
}

export function saveCalendarFilters(filters: CalendarFilters): void {
  try {
    getStorage()?.setItem(CALENDAR_FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    return;
  }
}

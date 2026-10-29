import { addDays, differenceInCalendarDays } from "date-fns";
import type { ExternalEventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Permissions } from "@/lib/permissions";
import { buildVisibilityFilter } from "@/lib/event-visibility";
import { Visibility, canView, getVisibleVisibilities } from "@/lib/visibility";
import { formatDateForStorage, parseDateAndTime, parseStrictIsoDate } from "@/lib/date-picker-utils";
import { createShootingRangeLookup, getEventLocationDisplay, getRangeNameFromLocation } from "@/lib/event-location";
import { loadAbsencesInRange, type CalendarAbsence } from "@/lib/absence-service";
import { API_ROUTES } from "@/lib/api-routes";
import { findCollisions } from "@/lib/collisions";
import type { FeedFremdtermin, FeedTermin } from "@/lib/calendar";
import { periodFromStorage } from "@/lib/validation-schema";
import { addDaysToIsoDate, getAppTimeZone, getTimeZoneDateParts } from "@/lib/dates";

export const CALENDAR_MAX_RANGE_DAYS = 100;

export type { CalendarAbsence };

export interface CalendarRange {
  from: string;
  to: string;
}

export interface CalendarViewer {
  id: string;
  role: string;
}

export interface CalendarTermin {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string | null;
  type: string | null;
  location: string;
  visibility?: Visibility;
}

export interface CalendarFremdtermin {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  kind: ExternalEventKind | null;
  visibility?: Visibility;
  ausschreibung: { id: string; title: string; fileUrl: string } | null;
}

export interface CalendarData {
  termine: CalendarTermin[];
  fremdtermine: CalendarFremdtermin[];
  abwesenheiten: CalendarAbsence[];
  kollisionen?: string[];
}

export function parseCalendarRange(von: string | null, bis: string | null): CalendarRange | { error: string } {
  const from = parseStrictIsoDate(von);
  const to = parseStrictIsoDate(bis);
  if (!from || !to) {
    return { error: "Parameter von und bis müssen gültige Daten im Format JJJJ-MM-TT sein" };
  }
  const days = differenceInCalendarDays(to, from);
  if (days < 0) {
    return { error: "bis darf nicht vor von liegen" };
  }
  if (days >= CALENDAR_MAX_RANGE_DAYS) {
    return { error: `Der Zeitraum darf höchstens ${CALENDAR_MAX_RANGE_DAYS} Tage umfassen` };
  }
  return { from: von as string, to: bis as string };
}

function withVisibility<T extends { visibility: Visibility }>(entry: T, isLoggedIn: boolean) {
  if (isLoggedIn) return entry;
  const { visibility, ...rest } = entry;
  void visibility;
  return rest;
}

async function loadTermine(viewer: CalendarViewer | null, range: CalendarRange): Promise<CalendarTermin[]> {
  const events = await prisma.event.findMany({
    where: {
      ...buildVisibilityFilter(viewer?.id, Permissions.canAccessAdminArea(viewer?.role)),
      date: termineInRange(range),
    },
    orderBy: [{ date: "asc" }, { timeFrom: "asc" }],
    select: { id: true, date: true, timeFrom: true, timeTo: true, title: true, type: true, location: true, visibility: true },
  });

  const located = await withLocationDisplay(events);
  return located.map((event) => withVisibility(event, Boolean(viewer)));
}

async function withLocationDisplay<T extends { date: Date; location: string }>(events: T[]) {
  const rangeNames = [...new Set(events.map((event) => getRangeNameFromLocation(event.location)).filter(Boolean))];
  const ranges = rangeNames.length
    ? await prisma.shootingRange.findMany({
        where: { name: { in: rangeNames } },
        select: { name: true, street: true, postalCode: true, city: true },
      })
    : [];
  const rangeLookup = createShootingRangeLookup(ranges);

  return events.map((event) => ({
    ...event,
    date: formatDateForStorage(event.date),
    location: getEventLocationDisplay(event.location, rangeLookup),
  }));
}

function termineInRange(range: CalendarRange) {
  return { gte: parseDateAndTime(range.from, "00:00"), lt: addDays(parseDateAndTime(range.to, "00:00"), 1) };
}

function fremdtermineInRange(range: CalendarRange) {
  return {
    startDate: { lte: parseDateAndTime(range.to, "00:00") },
    endDate: { gte: parseDateAndTime(range.from, "00:00") },
  };
}

async function loadFremdtermine(viewer: CalendarViewer | null, range: CalendarRange): Promise<CalendarFremdtermin[]> {
  const isLoggedIn = Boolean(viewer);
  const externalEvents = await prisma.externalEvent.findMany({
    where: {
      ...(Permissions.canAccessAdminArea(viewer?.role)
        ? {}
        : { visibility: { in: getVisibleVisibilities(isLoggedIn) } }),
      ...fremdtermineInRange(range),
    },
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }],
    include: { ausschreibung: { select: { id: true, title: true, visibility: true } } },
  });

  return externalEvents.map(({ ausschreibung, ...event }) =>
    withVisibility(
      {
        id: event.id,
        title: event.title,
        ...periodFromStorage(event),
        location: event.location,
        description: event.description,
        url: event.url,
        kind: event.kind,
        visibility: event.visibility,
        ausschreibung:
          ausschreibung && canView(ausschreibung.visibility, isLoggedIn)
            ? {
                id: ausschreibung.id,
                title: ausschreibung.title,
                fileUrl: `${API_ROUTES.AUSSCHREIBUNGEN}/${ausschreibung.id}/file`,
              }
            : null,
      },
      isLoggedIn
    )
  );
}

export async function loadCalendarEntries(
  viewer: CalendarViewer | null,
  range: CalendarRange,
  now: Date = new Date()
): Promise<CalendarData> {
  const [termine, fremdtermine, abwesenheiten] = await Promise.all([
    loadTermine(viewer, range),
    loadFremdtermine(viewer, range),
    viewer ? loadAbsencesInRange(viewer, range, now) : Promise.resolve([]),
  ]);
  return { termine, fremdtermine, abwesenheiten };
}

export async function loadCalendar(
  viewer: CalendarViewer | null,
  range: CalendarRange,
  now: Date = new Date()
): Promise<CalendarData> {
  const calendar = await loadCalendarEntries(viewer, range, now);
  if (Permissions.canViewCollisions(viewer?.role)) {
    calendar.kollisionen = findCollisions(calendar).days;
  }
  return calendar;
}

export const CALENDAR_FEED_PAST_DAYS = 90;

export function getCalendarFeedRange(now: Date = new Date()): CalendarRange {
  const { year, month, day } = getTimeZoneDateParts(now, getAppTimeZone());
  const today = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const nextYear = new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
  return { from: addDaysToIsoDate(today, -CALENDAR_FEED_PAST_DAYS), to: nextYear };
}

export async function loadPublicCalendarFeed(
  now: Date = new Date()
): Promise<{ termine: FeedTermin[]; fremdtermine: FeedFremdtermin[] }> {
  const range = getCalendarFeedRange(now);
  const publicOnly = { visibility: { in: getVisibleVisibilities(false) } };
  const [events, fremdtermine] = await Promise.all([
    prisma.event.findMany({
      where: { ...publicOnly, date: termineInRange(range) },
      orderBy: [{ date: "asc" }, { timeFrom: "asc" }, { id: "asc" }],
      select: { id: true, date: true, timeFrom: true, timeTo: true, title: true, type: true, location: true, description: true, updatedAt: true },
    }),
    prisma.externalEvent.findMany({
      where: { ...publicOnly, ...fremdtermineInRange(range) },
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }],
      select: {
        id: true, title: true, startDate: true, endDate: true, allDay: true, timeFrom: true, timeTo: true,
        location: true, description: true, url: true, kind: true, updatedAt: true,
      },
    }),
  ]);

  return {
    termine: await withLocationDisplay(events),
    fremdtermine: fremdtermine.map((event) => ({ ...event, ...periodFromStorage(event) })),
  };
}

import type { ExternalEventKind } from "@prisma/client";
import { parseStrictIsoDate } from "@/lib/date-picker-utils";
import { getTerminTitle } from "@/lib/event-types";
import { loadCalendarEntries, type CalendarViewer } from "@/lib/calendar-service";
import { findItemsOnDay } from "@/lib/collisions";
import type { Visibility } from "@/lib/visibility";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface CollisionDayQuery {
  date: string;
  excludeTerminId?: string;
}

export interface CollisionDay {
  date: string;
  termine: { id: string; label: string; timeFrom: string; timeTo: string; type: string | null; visibility?: Visibility }[];
  fremdtermine: {
    id: string;
    title: string;
    kind: ExternalEventKind | null;
    startDate: string;
    endDate: string;
    allDay: boolean;
    timeFrom: string | null;
    timeTo: string | null;
  }[];
  abwesenheiten: { count: number; names: string[] };
}

export function parseCollisionDayQuery(datum: string | null, ohneTermin: string | null): CollisionDayQuery | { error: string } {
  if (!parseStrictIsoDate(datum)) {
    return { error: "Parameter datum muss ein gültiges Datum im Format JJJJ-MM-TT sein" };
  }
  if (ohneTermin !== null && !ID_PATTERN.test(ohneTermin)) {
    return { error: "Parameter ohneTermin ist ungültig" };
  }
  return { date: datum as string, ...(ohneTermin ? { excludeTerminId: ohneTermin } : {}) };
}

export async function loadCollisionDay(viewer: CalendarViewer, { date, excludeTerminId }: CollisionDayQuery): Promise<CollisionDay> {
  const calendar = await loadCalendarEntries(viewer, { from: date, to: date });
  const colliding = findItemsOnDay(calendar, date, excludeTerminId);
  const idsOf = (kind: string) => new Set(colliding.filter((item) => item.kind === kind).map((item) => item.id));
  const terminIds = idsOf("termin");
  const fremdterminIds = idsOf("fremdtermin");
  const absenceIds = idsOf("abwesenheit");
  const absences = calendar.abwesenheiten.filter((absence) => absenceIds.has(absence.id));

  return {
    date,
    termine: calendar.termine
      .filter((termin) => terminIds.has(termin.id))
      .map((termin) => ({
        id: termin.id,
        label: getTerminTitle(termin),
        timeFrom: termin.timeFrom,
        timeTo: termin.timeTo,
        type: termin.type,
        visibility: termin.visibility,
      })),
    fremdtermine: calendar.fremdtermine
      .filter((fremdtermin) => fremdterminIds.has(fremdtermin.id))
      .map(({ id, title, kind, startDate, endDate, allDay, timeFrom, timeTo }) => ({
        id,
        title,
        kind,
        startDate,
        endDate,
        allDay,
        timeFrom,
        timeTo,
      })),
    abwesenheiten: {
      count: absences.length,
      names: [...new Set(absences.map((absence) => absence.userName).filter((name): name is string => Boolean(name)))].sort(
        (a, b) => a.localeCompare(b, "de")
      ),
    },
  };
}

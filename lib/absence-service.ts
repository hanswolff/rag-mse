import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Permissions } from "@/lib/permissions";
import { getGermanDateString, parseDateAndTime } from "@/lib/date-picker-utils";
import { periodFromStorage } from "@/lib/validation-schema";
import { serializeAbsence } from "@/lib/absence-request";
import { failValidation } from "@/lib/request-body-parser";
import type { AbsenceItem } from "@/types";

export const ABSENCE_RETENTION_DAYS = 30;
export const MAX_ACTIVE_ABSENCES_PER_USER = 100;
export const ACTIVE_ABSENCE_LIMIT_ERROR =
  `Sie haben bereits ${MAX_ACTIVE_ABSENCES_PER_USER} laufende oder künftige Abwesenheiten eingetragen. Bitte löschen Sie nicht mehr benötigte Einträge, bevor Sie weitere anlegen.`;

const ABSENCE_ORDER = [{ startDate: "asc" as const }, { endDate: "asc" as const }, { id: "asc" as const }];

export interface AbsenceViewer {
  id: string;
  role: string;
}

export interface CalendarAbsence {
  id: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  reason: string | null;
  userName: string | null;
  isOwn: boolean;
}

export function getAbsenceRetentionCutoff(now: Date = new Date()): Date {
  return subDays(parseDateAndTime(getGermanDateString(now), "00:00"), ABSENCE_RETENTION_DAYS);
}

export async function listOwnAbsences(userId: string, now: Date = new Date()): Promise<AbsenceItem[]> {
  const absences = await prisma.absence.findMany({
    where: { userId, endDate: { gte: getAbsenceRetentionCutoff(now) } },
    orderBy: ABSENCE_ORDER,
  });
  return absences.map(serializeAbsence);
}

export async function assertActiveAbsenceCapacity(
  userId: string,
  absence: { endDate: Date; excludeId?: string },
  routeInfo: { route: string; method: string },
  now: Date = new Date()
): Promise<void> {
  const today = parseDateAndTime(getGermanDateString(now), "00:00");
  if (absence.endDate < today) return;
  const active = await prisma.absence.count({
    where: {
      userId,
      endDate: { gte: today },
      ...(absence.excludeId ? { id: { not: absence.excludeId } } : {}),
    },
  });
  if (active >= MAX_ACTIVE_ABSENCES_PER_USER) {
    failValidation(routeInfo, [ACTIVE_ABSENCE_LIMIT_ERROR], []);
  }
}

export async function loadAbsencesInRange(
  viewer: AbsenceViewer,
  range: { from: string; to: string },
  now: Date = new Date()
): Promise<CalendarAbsence[]> {
  const rangeStart = parseDateAndTime(range.from, "00:00");
  const cutoff = getAbsenceRetentionCutoff(now);
  const absences = await prisma.absence.findMany({
    where: {
      ...(Permissions.canViewAllAbsences(viewer.role) ? {} : { userId: viewer.id }),
      startDate: { lte: parseDateAndTime(range.to, "00:00") },
      endDate: { gte: rangeStart > cutoff ? rangeStart : cutoff },
    },
    select: {
      id: true,
      userId: true,
      startDate: true,
      endDate: true,
      allDay: true,
      timeFrom: true,
      timeTo: true,
      reason: true,
      user: { select: { name: true } },
    },
    orderBy: ABSENCE_ORDER,
  });

  return absences.map(({ userId, user, ...absence }) => ({
    id: absence.id,
    ...periodFromStorage(absence),
    reason: absence.reason,
    userName: user.name,
    isOwn: userId === viewer.id,
  }));
}

export async function deleteExpiredAbsences(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.absence.deleteMany({
    where: { endDate: { lt: getAbsenceRetentionCutoff(now) } },
  });
  return count;
}

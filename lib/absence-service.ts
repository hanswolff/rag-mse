import { subDays } from "date-fns";
import type { Absence, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Permissions } from "@/lib/permissions";
import { getGermanDateString, parseDateAndTime } from "@/lib/date-picker-utils";
import { periodFromStorage } from "@/lib/validation-schema";
import { serializeAbsence, type AbsenceRequest } from "@/lib/absence-request";
import { failValidation } from "@/lib/request-body-parser";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth-utils";
import type { AbsenceItem, AbsenceOwnerOption } from "@/types";

export const ABSENCE_RETENTION_DAYS = 30;
export const MAX_ACTIVE_ABSENCES_PER_USER = 100;
const LIMIT_HINT = "Bitte löschen Sie nicht mehr benötigte Einträge, bevor Sie weitere anlegen.";
export const ACTIVE_ABSENCE_LIMIT_ERROR =
  `Sie haben bereits ${MAX_ACTIVE_ABSENCES_PER_USER} laufende oder künftige Abwesenheiten eingetragen. ${LIMIT_HINT}`;
const UNKNOWN_ABSENCE_OWNER_ERROR = "Benutzer nicht gefunden oder nicht aktiviert";

export function activeAbsenceLimitErrorFor(name: string | null): string {
  return `Für ${name ?? "diesen Benutzer"} sind bereits ${MAX_ACTIVE_ABSENCES_PER_USER} laufende oder künftige Abwesenheiten eingetragen. ${LIMIT_HINT}`;
}

const ABSENCE_ORDER = [{ startDate: "asc" as const }, { endDate: "asc" as const }, { id: "asc" as const }];

export interface AbsenceViewer {
  id: string;
  role: string;
}

type RouteInfo = { route: string; method: string };

interface AbsenceOwner {
  id: string;
  name: string | null;
  isActor: boolean;
}

type AbsenceEnteredBy = { kind: "self" } | { kind: "other"; name: string | null } | { kind: "removed" };

export interface CalendarAbsence {
  id: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  reason: string | null;
  userId: string;
  userName: string | null;
  isOwn: boolean;
  enteredBy: AbsenceEnteredBy;
}

export async function listAbsenceOwnerOptions(): Promise<AbsenceOwnerOption[]> {
  const users = await prisma.user.findMany({
    where: { activatedAt: { not: null } },
    select: { id: true, name: true },
  });
  return users.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "de"));
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

export async function createAbsence(actor: AbsenceViewer, request: AbsenceRequest, routeInfo: RouteInfo): Promise<Absence> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!(await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } }))) throw new UnauthorizedError();
    const owner = await resolveAbsenceOwner(tx, actor, request.userId ?? actor.id, routeInfo);
    await assertActiveAbsenceCapacity(tx, owner, { endDate: request.data.endDate }, routeInfo);
    return tx.absence.create({ data: { ...request.data, userId: owner.id, createdById: actor.id } });
  });
}

export async function updateAbsence(
  actor: AbsenceViewer,
  id: string,
  request: AbsenceRequest,
  routeInfo: RouteInfo
): Promise<{ absence: Absence; previousUserId: string } | null> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.absence.findFirst({
      where: { id, ...writableScope(actor) },
      select: { userId: true, createdById: true, user: { select: { name: true } } },
    });
    if (!existing) return null;
    const newOwnerId = request.userId !== undefined && request.userId !== existing.userId ? request.userId : null;
    const reassigned = newOwnerId !== null;
    const owner = reassigned
      ? await resolveAbsenceOwner(tx, actor, newOwnerId, routeInfo)
      : { id: existing.userId, name: existing.user.name, isActor: existing.userId === actor.id };
    await assertActiveAbsenceCapacity(tx, owner, { endDate: request.data.endDate, excludeId: id }, routeInfo);
    const enteredBySelf = existing.createdById === existing.userId;
    const absence = await tx.absence.update({
      where: { id },
      data: { ...request.data, userId: owner.id, ...(reassigned && enteredBySelf ? { createdById: actor.id } : {}) },
    });
    return { absence, previousUserId: existing.userId };
  });
}

export async function deleteAbsence(actor: AbsenceViewer, id: string): Promise<{ userId: string } | null> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.absence.findFirst({ where: { id, ...writableScope(actor) }, select: { userId: true } });
    if (existing) await tx.absence.delete({ where: { id } });
    return existing;
  });
}

function writableScope(actor: AbsenceViewer) {
  return Permissions.canManageAllAbsences(actor.role) ? {} : { userId: actor.id };
}

async function resolveAbsenceOwner(
  tx: Prisma.TransactionClient,
  actor: AbsenceViewer,
  userId: string,
  routeInfo: RouteInfo
): Promise<AbsenceOwner> {
  if (userId === actor.id) return { id: actor.id, name: null, isActor: true };
  if (!Permissions.canManageAllAbsences(actor.role)) {
    throw new ForbiddenError("Keine Berechtigung für Abwesenheiten anderer Benutzer");
  }
  const owner = await tx.user.findFirst({
    where: { id: userId, activatedAt: { not: null } },
    select: { id: true, name: true },
  });
  if (!owner) {
    failValidation(routeInfo, [UNKNOWN_ABSENCE_OWNER_ERROR], [{ field: "userId", message: UNKNOWN_ABSENCE_OWNER_ERROR }]);
  }
  return { ...owner, isActor: false };
}

async function assertActiveAbsenceCapacity(
  tx: Prisma.TransactionClient,
  owner: AbsenceOwner,
  absence: { endDate: Date; excludeId?: string },
  routeInfo: RouteInfo
): Promise<void> {
  const today = parseDateAndTime(getGermanDateString(new Date()), "00:00");
  if (absence.endDate < today) return;
  const active = await tx.absence.count({
    where: {
      userId: owner.id,
      endDate: { gte: today },
      ...(absence.excludeId ? { id: { not: absence.excludeId } } : {}),
    },
  });
  if (active < MAX_ACTIVE_ABSENCES_PER_USER) return;
  if (owner.isActor) failValidation(routeInfo, [ACTIVE_ABSENCE_LIMIT_ERROR], []);
  const message = activeAbsenceLimitErrorFor(owner.name);
  failValidation(routeInfo, [message], [{ field: "userId", message }]);
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
      createdById: true,
      user: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: ABSENCE_ORDER,
  });

  return absences.map(({ userId, user, createdById, createdBy, ...absence }) => ({
    id: absence.id,
    ...periodFromStorage(absence),
    reason: absence.reason,
    userId,
    userName: user.name,
    isOwn: userId === viewer.id,
    enteredBy: enteredBy(userId, createdById, createdBy),
  }));
}

function enteredBy(ownerId: string, createdById: string | null, creator: { name: string | null } | null): AbsenceEnteredBy {
  if (createdById === ownerId) return { kind: "self" };
  return creator ? { kind: "other", name: creator.name } : { kind: "removed" };
}

export async function deleteExpiredAbsences(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.absence.deleteMany({
    where: { endDate: { lt: getAbsenceRetentionCutoff(now) } },
  });
  return count;
}

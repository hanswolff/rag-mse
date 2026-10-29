import { z } from "zod";
import { isTimeRangeValid } from "../dates";
import { formatDateForStorage, parseDateAndTime } from "../date-picker-utils";
import { isValidIsoDate, timeRegex } from "./core";

export interface PeriodInput {
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string;
  timeTo: string;
}

export interface NormalizedPeriod {
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
}

export const PERIOD_START_LABEL = "Von";
export const PERIOD_END_LABEL = "Bis";

const requiredPeriodDateSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} ist erforderlich`)
    .refine((value) => !value || isValidIsoDate(value), { message: `${label} ist ungültig` });

const optionalPeriodTimeSchema = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => !value || timeRegex.test(value), { message: `Ungültiges Zeitformat für ${label}` });

export const periodStartDateSchema = requiredPeriodDateSchema(PERIOD_START_LABEL);
export const periodEndDateSchema = requiredPeriodDateSchema(PERIOD_END_LABEL);
export const periodTimeFromSchema = optionalPeriodTimeSchema("Uhrzeit von");
export const periodTimeToSchema = optionalPeriodTimeSchema("Uhrzeit bis");

export const periodShape = {
  startDate: periodStartDateSchema,
  endDate: periodEndDateSchema,
  allDay: z.boolean(),
  timeFrom: periodTimeFromSchema,
  timeTo: periodTimeToSchema,
};

export const PERIOD_END_BEFORE_START_ERROR = `„${PERIOD_END_LABEL}“ darf nicht vor „${PERIOD_START_LABEL}“ liegen`;
export const PERIOD_TIME_ORDER_ERROR = "Uhrzeit bis muss nach Uhrzeit von liegen";

export function addPeriodIssues(period: PeriodInput, ctx: z.RefinementCtx): void {
  const startDate = period.startDate.trim();
  const endDate = period.endDate.trim();
  const timeFrom = period.timeFrom.trim();
  const timeTo = period.timeTo.trim();
  const datesValid = isValidIsoDate(startDate) && isValidIsoDate(endDate);

  if (datesValid && endDate < startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: PERIOD_END_BEFORE_START_ERROR });
  }

  if (period.allDay) return;

  if (!timeFrom) {
    ctx.addIssue({ code: "custom", path: ["timeFrom"], message: "Uhrzeit von ist erforderlich, wenn nicht ganztägig" });
  }
  if (!timeTo) {
    ctx.addIssue({ code: "custom", path: ["timeTo"], message: "Uhrzeit bis ist erforderlich, wenn nicht ganztägig" });
  }

  const timesValid = timeRegex.test(timeFrom) && timeRegex.test(timeTo);
  if (datesValid && timesValid && startDate === endDate && !isTimeRangeValid(timeFrom, timeTo)) {
    ctx.addIssue({ code: "custom", path: ["timeTo"], message: PERIOD_TIME_ORDER_ERROR });
  }
}

export function normalizePeriod(period: PeriodInput): NormalizedPeriod {
  return {
    startDate: period.startDate.trim(),
    endDate: period.endDate.trim(),
    allDay: period.allDay,
    timeFrom: period.allDay ? null : period.timeFrom.trim(),
    timeTo: period.allDay ? null : period.timeTo.trim(),
  };
}

export interface StoredPeriod {
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
}

export function periodToStorage(period: PeriodInput): StoredPeriod {
  const normalized = normalizePeriod(period);
  return {
    ...normalized,
    startDate: parseDateAndTime(normalized.startDate, "00:00"),
    endDate: parseDateAndTime(normalized.endDate, "00:00"),
  };
}

export function periodFromStorage({ startDate, endDate, allDay, timeFrom, timeTo }: StoredPeriod): NormalizedPeriod {
  return {
    startDate: formatDateForStorage(startDate),
    endDate: formatDateForStorage(endDate),
    allDay,
    timeFrom,
    timeTo,
  };
}

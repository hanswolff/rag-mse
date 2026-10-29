import { z } from "zod";
import { isValidIsoDate } from "./core";
import type { FieldValidationConfig } from "./field-config";
import {
  addPeriodIssues,
  periodEndDateSchema,
  periodShape,
  periodStartDateSchema,
  periodTimeFromSchema,
  periodTimeToSchema,
} from "./period";

export const MAX_ABSENCE_REASON_LENGTH = 200;
export const MAX_ABSENCE_DURATION_DAYS = 365;
export const ABSENCE_TOO_LONG_ERROR = `Eine Abwesenheit darf höchstens ${MAX_ABSENCE_DURATION_DAYS} Tage dauern`;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetweenIsoDates(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS;
}

const absenceReasonSchema = z
  .string()
  .trim()
  .max(MAX_ABSENCE_REASON_LENGTH, `Grund darf maximal ${MAX_ABSENCE_REASON_LENGTH} Zeichen haben`);

export const absenceFormSchema = z
  .object({
    ...periodShape,
    reason: absenceReasonSchema,
  })
  .superRefine(addPeriodIssues)
  .superRefine(({ startDate, endDate }, ctx) => {
    const start = startDate.trim();
    const end = endDate.trim();
    if (isValidIsoDate(start) && isValidIsoDate(end) && daysBetweenIsoDates(start, end) >= MAX_ABSENCE_DURATION_DAYS) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: ABSENCE_TOO_LONG_ERROR });
    }
  });

export type AbsenceFormInput = z.input<typeof absenceFormSchema>;

export const absenceValidationConfig: Record<string, FieldValidationConfig> = {
  startDate: { zod: periodStartDateSchema },
  endDate: { zod: periodEndDateSchema },
  timeFrom: { zod: periodTimeFromSchema },
  timeTo: { zod: periodTimeToSchema },
  reason: { zod: absenceReasonSchema },
};

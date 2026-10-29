import { z } from "zod";
import {
  addPeriodIssues,
  normalizePeriod,
  periodShape,
  PERIOD_END_BEFORE_START_ERROR,
  PERIOD_TIME_ORDER_ERROR,
  type PeriodInput,
} from "@/lib/validation-schema";

const periodSchema = z.object(periodShape).superRefine(addPeriodIssues);

const allDay: PeriodInput = { startDate: "2026-11-06", endDate: "2026-11-08", allDay: true, timeFrom: "", timeTo: "" };
const timed: PeriodInput = { startDate: "2026-11-06", endDate: "2026-11-06", allDay: false, timeFrom: "09:00", timeTo: "17:00" };

function errorsOf(input: PeriodInput): Record<string, string> {
  const result = periodSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe("Zeitraum-Validierung", () => {
  it("akzeptiert einen mehrtägigen ganztägigen Zeitraum ohne Uhrzeiten", () => {
    expect(errorsOf(allDay)).toEqual({});
  });

  it("akzeptiert einen eintägigen Zeitraum, der am selben Tag endet", () => {
    expect(errorsOf({ ...allDay, endDate: allDay.startDate })).toEqual({});
  });

  it("lehnt ein Ende vor dem Start ab", () => {
    expect(errorsOf({ ...allDay, endDate: "2026-11-05" })).toEqual({ endDate: PERIOD_END_BEFORE_START_ERROR });
  });

  it("verlangt beide Daten in gültigem Format", () => {
    expect(errorsOf({ ...allDay, startDate: "", endDate: "2026-02-30" })).toEqual({
      startDate: "Von ist erforderlich",
      endDate: "Bis ist ungültig",
    });
  });

  it("verlangt ohne Ganztag beide Uhrzeiten", () => {
    expect(errorsOf({ ...timed, timeFrom: "", timeTo: "" })).toEqual({
      timeFrom: "Uhrzeit von ist erforderlich, wenn nicht ganztägig",
      timeTo: "Uhrzeit bis ist erforderlich, wenn nicht ganztägig",
    });
  });

  it("verlangt das Format HH:MM", () => {
    expect(errorsOf({ ...timed, timeFrom: "9:00" })).toEqual({
      timeFrom: "Ungültiges Zeitformat für Uhrzeit von",
    });
  });

  it("verlangt am selben Tag ein Ende nach dem Beginn", () => {
    expect(errorsOf({ ...timed, timeTo: "09:00" })).toEqual({ timeTo: PERIOD_TIME_ORDER_ERROR });
  });

  it("erlaubt über mehrere Tage ein früheres Uhrzeit-Ende", () => {
    expect(errorsOf({ ...timed, endDate: "2026-11-07", timeFrom: "18:00", timeTo: "08:00" })).toEqual({});
  });

  it("ignoriert Uhrzeiten bei Ganztag und leert sie beim Normalisieren", () => {
    const input = { ...allDay, timeFrom: "18:00", timeTo: "08:00" };
    expect(errorsOf(input)).toEqual({});
    expect(normalizePeriod(input)).toEqual({ ...allDay, timeFrom: null, timeTo: null });
  });

  it("behält Uhrzeiten ohne Ganztag", () => {
    expect(normalizePeriod({ ...timed, timeFrom: " 09:00 " })).toEqual(timed);
  });
});

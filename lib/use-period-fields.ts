"use client";

import { useState } from "react";
import type { ZodType } from "zod";
import { useCrossFieldValidation } from "@/lib/use-cross-field-validation";
import type { PeriodInput } from "@/lib/validation-schema";

type PeriodErrorField = "endDate" | "timeFrom" | "timeTo";

export interface PeriodFieldsControl {
  periodError: (field: PeriodErrorField) => string | undefined;
  setStartDate: (startDate: string) => void;
  setAllDay: (allDay: boolean) => void;
  validatePeriod: () => boolean;
}

export function usePeriodFields<S extends Record<string, unknown>, T extends S & PeriodInput>(
  schema: ZodType<S>,
  data: T,
  setData: (data: T) => void,
  isOpen: boolean
): PeriodFieldsControl {
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setSubmitAttempted(false);
  }

  const periodErrors = useCrossFieldValidation<S>(schema, data, { customOnly: true });

  return {
    periodError: (field: PeriodErrorField) => (submitAttempted || data[field] ? periodErrors[field] : undefined),
    setStartDate: (startDate: string) => {
      const endDate = !data.endDate || data.endDate < startDate ? startDate : data.endDate;
      setData({ ...data, startDate, endDate });
    },
    setAllDay: (allDay: boolean) => {
      setData({ ...data, allDay, ...(allDay ? { timeFrom: "", timeTo: "" } : {}) });
    },
    validatePeriod: () => {
      setSubmitAttempted(true);
      return Object.keys(periodErrors).length === 0;
    },
  };
}


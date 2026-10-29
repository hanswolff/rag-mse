"use client";

import { GermanDatePicker } from "./german-date-picker";
import { GermanTimePicker } from "./german-time-picker";
import type { PeriodFieldsControl } from "@/lib/use-period-fields";
import { PERIOD_END_LABEL, PERIOD_START_LABEL, type PeriodInput } from "@/lib/validation-schema";

type PeriodField = keyof PeriodInput;

interface PeriodFieldsProps {
  idPrefix: string;
  data: PeriodInput;
  period: PeriodFieldsControl;
  disabled: boolean;
  getFieldError: (field: PeriodField) => string | undefined;
  handleChange: (field: PeriodField, value: string) => void;
  handleBlur: (field: PeriodField, value: string) => void;
}

export function PeriodFields({ idPrefix, data, period, disabled, getFieldError, handleChange, handleBlur }: PeriodFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GermanDatePicker
          id={`${idPrefix}-start-date`}
          label={PERIOD_START_LABEL}
          value={data.startDate}
          onChange={period.setStartDate}
          onBlur={() => handleBlur("startDate", data.startDate)}
          required
          disabled={disabled}
          error={getFieldError("startDate")}
        />
        <GermanDatePicker
          id={`${idPrefix}-end-date`}
          label={PERIOD_END_LABEL}
          value={data.endDate}
          onChange={(endDate) => handleChange("endDate", endDate)}
          onBlur={() => handleBlur("endDate", data.endDate)}
          required
          disabled={disabled}
          error={getFieldError("endDate") || period.periodError("endDate")}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-all-day`}
          type="checkbox"
          checked={data.allDay}
          onChange={(e) => period.setAllDay(e.target.checked)}
          className="form-checkbox"
          disabled={disabled}
        />
        <label htmlFor={`${idPrefix}-all-day`} className="text-base text-gray-700">
          Ganztägig
        </label>
      </div>

      {!data.allDay && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GermanTimePicker
            id={`${idPrefix}-time-from`}
            label="Uhrzeit von"
            value={data.timeFrom}
            onChange={(time) => handleChange("timeFrom", time)}
            onBlur={() => handleBlur("timeFrom", data.timeFrom)}
            required
            disabled={disabled}
            error={getFieldError("timeFrom") || period.periodError("timeFrom")}
          />
          <GermanTimePicker
            id={`${idPrefix}-time-to`}
            label="Uhrzeit bis"
            value={data.timeTo}
            onChange={(time) => handleChange("timeTo", time)}
            onBlur={() => handleBlur("timeTo", data.timeTo)}
            required
            disabled={disabled}
            error={getFieldError("timeTo") || period.periodError("timeTo")}
          />
        </div>
      )}
    </>
  );
}

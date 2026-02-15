"use client";

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, isValid, parse } from "date-fns";
import { de } from "date-fns/locale";
import { FiCalendar } from "react-icons/fi";
import { parseISODate } from "@/lib/date-picker-utils";

interface GermanDatePickerProps {
  id?: string;
  value: string | null;
  onChange: (date: string) => void;
  onBlur?: () => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Shows success checkmark when field is valid, touched, and has value */
  showSuccess?: boolean;
}

export function GermanDatePicker({ id, value, onChange, onBlur, error, label, required, disabled, autoFocus, showSuccess }: GermanDatePickerProps) {
  const errorId = error ? `error-${id || 'date'}` : undefined;
  const date = useMemo(() => (value ? parseISODate(value) : null), [value]);
  const showCheckmark = showSuccess && !error;

  function handleDateChange(date: Date | null) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
  }

  function handleRawChange(event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
    const inputElement = event?.currentTarget as HTMLInputElement | null;
    const nextValue = inputElement?.value ?? "";

    if (!nextValue.trim()) {
      onChange("");
      return;
    }

    const parsedDate = parse(nextValue, "dd.MM.yyyy", new Date());
    if (isValid(parsedDate) && format(parsedDate, "dd.MM.yyyy") === nextValue) {
      onChange(format(parsedDate, "yyyy-MM-dd"));
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <DatePicker
          id={id}
          selected={date}
          onChange={handleDateChange}
          onChangeRaw={handleRawChange}
          onBlur={onBlur}
          locale={de}
          dateFormat="dd.MM.yyyy"
          placeholderText="TT.MM.JJJJ"
          className={`form-input w-full pl-10 ${showCheckmark ? 'pr-8 border-green-500 focus:border-green-500' : ''} ${error ? 'border-red-500' : ''}`}
          showPopperArrow={true}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        {showCheckmark && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none"
            aria-hidden="true"
          >
            &#10003;
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-red-500 text-sm mt-1" role="alert">{error}</p>
      )}
    </div>
  );
}

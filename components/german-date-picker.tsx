"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { FiCalendar } from "react-icons/fi";
import { parseISODate } from "@/lib/date-picker-utils";

interface GermanDatePickerProps {
  id?: string;
  value: string | null;
  onChange: (date: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function GermanDatePicker({ id, value, onChange, error, label, required, disabled, autoFocus }: GermanDatePickerProps) {
  const errorId = error ? `error-${id || 'date'}` : undefined;
  const date = value ? parseISODate(value) : null;

  function handleDateChange(date: Date | null) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="form-label">{label}</label>
      )}
      <div className="relative">
        <DatePicker
          id={id}
          key={value}
          selected={date}
          onChange={handleDateChange}
          locale={de}
          dateFormat="dd.MM.yyyy"
          placeholderText="TT.MM.JJJJ"
          className={`form-input w-full pl-10 ${error ? 'border-red-500' : ''}`}
          showPopperArrow={true}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
      {error && (
        <p id={errorId} className="text-red-500 text-sm mt-1" role="alert">{error}</p>
      )}
    </div>
  );
}

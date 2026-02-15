"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { de } from "date-fns/locale";
import { FiClock } from "react-icons/fi";
import { parseTime } from "@/lib/date-picker-utils";

interface GermanTimePickerProps {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  error?: string;
  label?: string;
  timeIntervals?: number;
  required?: boolean;
  disabled?: boolean;
  /** Shows success checkmark when field is valid, touched, and has value */
  showSuccess?: boolean;
}

export function GermanTimePicker({ id, value, onChange, error, label, timeIntervals = 15, required, disabled, showSuccess }: GermanTimePickerProps) {
  const errorId = error ? `error-${id || 'time'}` : undefined;
  const time = value ? parseTime(value) : null;
  const showCheckmark = showSuccess && !error;

  function handleTimeChange(date: Date | null) {
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      onChange(`${hours}:${minutes}`);
    } else {
      onChange('');
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
          key={value}
          selected={time}
          onChange={handleTimeChange}
          locale={de}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={timeIntervals}
          timeCaption="Uhrzeit"
          dateFormat="HH:mm"
          placeholderText="HH:MM"
          className={`form-input w-full pl-10 ${showCheckmark ? 'pr-8 border-green-500 focus:border-green-500' : ''} ${error ? 'border-red-500' : ''}`}
          required={required}
          disabled={disabled}
        />
        <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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

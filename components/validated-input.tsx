"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

export interface ValidatedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur"> {
  label: string;
  error?: string;
  /** Shows success checkmark when field is valid, touched, and has value */
  showSuccess?: boolean;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
}

export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  function ValidatedInput(
    {
      label,
      error,
      showSuccess,
      onChange,
      onBlur,
      required,
      maxLength,
      className = "",
      id,
      ...props
    },
    ref
  ) {
    const inputId = id || props.name;
    const errorId = inputId ? `${inputId}-error` : undefined;
    const showCheckmark = showSuccess && !error;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e.target.value);
    };

    const errorClasses = error ? "border-red-500 focus:border-red-500" : "";
    const successClasses = showCheckmark ? "border-green-500 focus:border-green-500 pr-8" : "";
    const inputClassName = `form-input ${errorClasses} ${successClasses} ${className}`.trim();

    return (
      <div>
        <label htmlFor={inputId} className="form-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={inputClassName}
            required={required}
            maxLength={maxLength}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={handleChange}
            onBlur={handleBlur}
            {...props}
          />
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
          <p id={errorId} className="form-help text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

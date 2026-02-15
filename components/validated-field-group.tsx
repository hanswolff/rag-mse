"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  /** Shows success styling when field is valid, touched, and has value */
  showSuccess?: boolean;
  helpText?: string;
};

export interface ValidatedFieldGroupProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "required"> {
  type?: "text" | "email" | "tel" | "password" | "number" | "url" | "date";
  as?: "input";
}

export interface ValidatedTextareaGroupProps extends BaseProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "required"> {
  as: "textarea";
}

type CombinedProps = ValidatedFieldGroupProps | ValidatedTextareaGroupProps;

export const ValidatedFieldGroup = forwardRef<HTMLInputElement | HTMLTextAreaElement, CombinedProps>(
  function ValidatedFieldGroup(allProps, ref) {
    const {
      label,
      name,
      error,
      required,
      showSuccess,
      helpText,
      className = "",
      id,
      ...restProps
    } = allProps;

    const fieldId = id || name;
    const errorId = `${fieldId}-error`;
    const helpId = `${fieldId}-help`;

    const showCheckmark = showSuccess && !error && !helpText;
    const baseInputClasses = "form-input";
    const errorClasses = error ? "border-red-500 focus:border-red-500" : "";
    const successClasses = showSuccess && !error ? "border-green-500 focus:border-green-500" : "";
    const checkmarkPadding = showCheckmark ? "pr-8" : "";
    const inputClassName = `${baseInputClasses} ${errorClasses} ${successClasses} ${checkmarkPadding} ${className}`.trim();

    const ariaDescribedBy = [
      error ? errorId : null,
      helpText && !error ? helpId : null,
    ].filter(Boolean).join(" ") || undefined;

    const sharedProps = {
      id: fieldId,
      name,
      required,
      className: inputClassName,
      "aria-invalid": !!error,
      "aria-describedby": ariaDescribedBy,
      disabled: restProps.disabled,
    };

    const isTextarea = allProps.as === "textarea";

    return (
      <div>
        <label htmlFor={fieldId} className="form-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        <div className="relative">
          {isTextarea ? (
            <textarea
              ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
              {...sharedProps}
              {...(restProps as Omit<ValidatedTextareaGroupProps, "as">)}
            />
          ) : (
            <input
              ref={ref as React.ForwardedRef<HTMLInputElement>}
              type={(restProps as ValidatedFieldGroupProps).type ?? "text"}
              {...sharedProps}
              {...(restProps as Omit<ValidatedFieldGroupProps, "as">)}
            />
          )}
          {showCheckmark && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none"
              aria-hidden="true"
            >
              &#10003;
            </span>
          )}
        </div>

        <div className="mt-1">
          {error && (
            <p id={errorId} className="form-help text-red-600" role="alert">
              {error}
            </p>
          )}
          {!error && helpText && (
            <p id={helpId} className="form-help text-gray-500">
              {helpText}
            </p>
          )}
        </div>
      </div>
    );
  }
);

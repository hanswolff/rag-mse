"use client";

import { useState, useCallback } from "react";
import type { ZodType } from "zod";

export interface FieldValidationConfig {
  zod: ZodType<string>;
}

export interface ValidationConfig {
  [fieldName: string]: FieldValidationConfig;
}

export interface UseFormFieldValidationResult {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  validateField: (fieldName: string, value: string) => void;
  /** Validates all provided fields, marks them as touched, and returns true if all are valid */
  validateAllFields: (values: Record<string, string>) => boolean;
  clearFieldError: (fieldName: string) => void;
  isFieldTouched: (fieldName: string) => boolean;
  isFieldValid: (fieldName: string, value: string) => boolean;
  markFieldAsTouched: (fieldName: string) => void;
  shouldShowError: (fieldName: string, value: string, wasSubmitted?: boolean) => boolean;
  /** Returns true if field is touched and has no error (for success state styling) */
  isValidAndTouched: (fieldName: string, value: string) => boolean;
  reset: () => void;
}

function getValidationError(value: string, config: FieldValidationConfig): string | null {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  const parsed = config.zod.safeParse(normalizedValue);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message || "Ungültiger Wert";
  }
  return null;
}

export function useFormFieldValidation(
  config: ValidationConfig
): UseFormFieldValidationResult {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (fieldName: string, value: string) => {
      const fieldConfig = config[fieldName];
      if (!fieldConfig) return;

      const error = getValidationError(value, fieldConfig);
      setErrors((prev) => {
        const nextErrors = { ...prev };
        if (error) {
          nextErrors[fieldName] = error;
        } else {
          delete nextErrors[fieldName];
        }
        return nextErrors;
      });
    },
    [config]
  );

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  }, []);

  const markFieldAsTouched = useCallback((fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  }, []);

  const isFieldTouched = useCallback((fieldName: string) => touched[fieldName] || false, [touched]);

  const isFieldValid = useCallback(
    (fieldName: string, value: string) => {
      const fieldConfig = config[fieldName];
      if (!fieldConfig) return true;

      const error = getValidationError(value, fieldConfig);
      return error === null;
    },
    [config]
  );

  const shouldShowError = useCallback(
    (fieldName: string, value: string, wasSubmitted = false): boolean => {
      const isInvalid = !isFieldValid(fieldName, value);
      const wasTouched = isFieldTouched(fieldName);
      return (wasTouched || wasSubmitted) && isInvalid;
    },
    [isFieldValid, isFieldTouched]
  );

  const isValidAndTouched = useCallback(
    (fieldName: string, value: string): boolean => {
      const valid = isFieldValid(fieldName, value);
      const wasTouched = isFieldTouched(fieldName);
      return wasTouched && valid && value.trim().length > 0;
    },
    [isFieldValid, isFieldTouched]
  );

  const validateAllFields = useCallback(
    (values: Record<string, string>): boolean => {
      const fieldNames = Object.keys(values);
      const newErrors: Record<string, string> = {};
      const newTouched: Record<string, boolean> = {};
      let allValid = true;

      fieldNames.forEach((fieldName) => {
        // Skip fields that are not in the validation config
        if (!config[fieldName]) return;

        const value = values[fieldName] ?? "";
        const error = getValidationError(value, config[fieldName]);

        newTouched[fieldName] = true;

        if (error) {
          newErrors[fieldName] = error;
          allValid = false;
        }
      });

      setErrors((prev) => {
        const nextErrors = { ...prev };
        fieldNames.forEach((fieldName) => {
          if (!config[fieldName]) return;
          delete nextErrors[fieldName];
        });
        return { ...nextErrors, ...newErrors };
      });
      setTouched((prev) => ({ ...prev, ...newTouched }));

      return allValid;
    },
    [config]
  );

  const reset = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return {
    errors,
    touched,
    validateField,
    validateAllFields,
    clearFieldError,
    isFieldTouched,
    isFieldValid,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
    reset,
  };
}

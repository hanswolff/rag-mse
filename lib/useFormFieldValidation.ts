"use client";

import { useState, useCallback } from "react";

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => string | null;
}

export interface FieldValidationConfig {
  rules: ValidationRule;
  errorMessages: {
    required?: string;
    minLength?: string;
    maxLength?: string;
    pattern?: string;
    custom?: string;
  };
}

export interface ValidationConfig {
  [fieldName: string]: FieldValidationConfig;
}

export interface UseFormFieldValidationResult {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  validateField: (fieldName: string, value: string) => void;
  validateAll: (values: Record<string, string>) => boolean;
  clearFieldError: (fieldName: string) => void;
  isFieldTouched: (fieldName: string) => boolean;
  isFieldValid: (fieldName: string, value: string) => boolean;
  markFieldAsTouched: (fieldName: string) => void;
  shouldShowError: (fieldName: string, value: string, wasSubmitted?: boolean) => boolean;
  reset: () => void;
}

function getValidationError(
  value: string,
  rules: ValidationRule,
  errorMessages: FieldValidationConfig['errorMessages']
): string | null {
  const trimmedValue = value.trim();

  if (rules.required && !trimmedValue) {
    return errorMessages.required || "";
  }

  const hasValue = trimmedValue.length > 0;

  if (hasValue) {
    if (rules.minLength && trimmedValue.length < rules.minLength) {
      return errorMessages.minLength || "";
    }

    if (rules.maxLength && trimmedValue.length > rules.maxLength) {
      return errorMessages.maxLength || "";
    }

    if (rules.pattern && !rules.pattern.test(trimmedValue)) {
      return errorMessages.pattern || "";
    }

    if (rules.customValidator) {
      return rules.customValidator(trimmedValue);
    }
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

      const error = getValidationError(value, fieldConfig.rules, fieldConfig.errorMessages);
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[fieldName] = error;
        } else {
          delete newErrors[fieldName];
        }
        return newErrors;
      });
    },
    [config]
  );

  const validateAll = useCallback(
    (values: Record<string, string>) => {
      const allErrors: Record<string, string> = {};
      let hasErrors = false;

      Object.keys(config).forEach((fieldName) => {
        const value = values[fieldName] || "";
        const fieldConfig = config[fieldName];
        const error = getValidationError(value, fieldConfig.rules, fieldConfig.errorMessages);
        if (error) {
          allErrors[fieldName] = error;
          hasErrors = true;
        }
      });

      setErrors(allErrors);
      return !hasErrors;
    },
    [config]
  );

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors((prev) => ({ ...prev, [fieldName]: "" }));
  }, []);

  const markFieldAsTouched = useCallback((fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  }, []);

  const isFieldTouched = useCallback(
    (fieldName: string) => touched[fieldName] || false,
    [touched]
  );

  const isFieldValid = useCallback(
    (fieldName: string, value: string) => {
      const fieldConfig = config[fieldName];
      if (!fieldConfig) return true;

      const error = getValidationError(value, fieldConfig.rules, fieldConfig.errorMessages);
      return error === null;
    },
    [config]
  );

  const shouldShowError = useCallback(
    (fieldName: string, value: string, wasSubmitted = false): boolean => {
      const isInvalid = !isFieldValid(fieldName, value);
      const wasTouched = isFieldTouched(fieldName);
      return (wasTouched || wasSubmitted) && isInvalid && !!errors[fieldName];
    },
    [isFieldValid, isFieldTouched, errors]
  );

  const reset = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return {
    errors,
    touched,
    validateField,
    validateAll,
    clearFieldError,
    isFieldTouched,
    isFieldValid,
    markFieldAsTouched,
    shouldShowError,
    reset,
  };
}

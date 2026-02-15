"use client";

import { useMemo } from "react";
import type { ZodType } from "zod";

export interface UseCrossFieldValidationOptions {
  /**
   * When true, only returns errors from custom validation (refine/superRefine).
   * Filters out Zod's built-in validation errors like "required", "min", "max", "email", etc.
   * Use this when you only want cross-field validation errors (e.g., password matching).
   *
   * @default false
   */
  customOnly?: boolean;
}

/**
 * Hook for validating cross-field dependencies (e.g., password confirmation, time ranges).
 * Uses full schema parsing to catch refine() validation errors that field-level validation misses.
 *
 * @param schema - The full Zod schema including cross-field validation rules
 * @param data - The form data object to validate
 * @param options - Configuration options
 * @returns Object mapping field names to their cross-field error messages
 *
 * @example
 * // Get all schema errors
 * const crossFieldErrors = useCrossFieldValidation(passwordChangeFormSchema, {
 *   currentPassword,
 *   newPassword,
 *   confirmPassword,
 * });
 *
 * @example
 * // Get only custom (cross-field) errors, filtering out field-level validation
 * const crossFieldErrors = useCrossFieldValidation(passwordChangeFormSchema, formData, { customOnly: true });
 * // Returns: { confirmPassword: "Passwörter stimmen nicht überein" } if passwords don't match
 * // Does NOT return: { newPassword: "Neues Passwort ist erforderlich" } for empty fields
 */
export function useCrossFieldValidation<T extends Record<string, unknown>>(
  schema: ZodType<T>,
  data: T,
  options?: UseCrossFieldValidationOptions
): Record<string, string> {
  const { customOnly = false } = options ?? {};

  return useMemo(() => {
    const result = schema.safeParse(data);
    if (result.success) return {};

    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      if (!field) return;

      // If customOnly is true, only include custom validation errors (from refine/superRefine)
      // These have code "custom" and are the cross-field validations we want
      if (customOnly && issue.code !== "custom") {
        return;
      }

      errors[field] = issue.message;
    });
    return errors;
  }, [schema, data, customOnly]);
}

import type { FieldError } from "./server-error-mapper";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors?: FieldError[];
}

export interface ValidationContext {
  errors: string[];
  fieldErrors: FieldError[];
  addError: (field: string, message: string) => void;
  toResult: () => ValidationResult;
}

export function createValidationContext(): ValidationContext {
  const errors: string[] = [];
  const fieldErrors: FieldError[] = [];

  return {
    errors,
    fieldErrors,
    addError(field: string, message: string) {
      errors.push(message);
      fieldErrors.push({ field, message });
    },
    toResult(): ValidationResult {
      return {
        isValid: errors.length === 0,
        errors,
        fieldErrors,
      };
    },
  };
}

type SafeParseResult =
  | { success: true }
  | { success: false; error: { issues: Array<{ message: string; path: PropertyKey[] }> } };

export function zodToValidationResult(result: SafeParseResult): ValidationResult {
  if (result.success) {
    return { isValid: true, errors: [], fieldErrors: [] };
  }
  return {
    isValid: false,
    errors: result.error.issues.map((issue) => issue.message),
    fieldErrors: result.error.issues
      .filter((issue) => issue.path.length > 0)
      .map((issue) => ({ field: String(issue.path[0]), message: issue.message })),
  };
}

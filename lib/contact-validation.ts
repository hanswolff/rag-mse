import { contactFormSchema } from "./validation-schema";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export function validateContactFormData(data: ContactFormData): ValidationResult {
  const result = contactFormSchema.safeParse(data);
  const errors = result.success ? [] : result.error.issues.map((issue) => issue.message);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

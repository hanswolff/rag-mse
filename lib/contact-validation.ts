import { contactFormSchema } from "./validation-schema";
import { zodToValidationResult } from "./validation-context";
import type { ValidationResult } from "./validation-context";

export type { ValidationResult } from "./validation-context";

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export function validateContactFormData(data: ContactFormData): ValidationResult {
  return zodToValidationResult(contactFormSchema.safeParse(data));
}

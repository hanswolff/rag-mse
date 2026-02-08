import { validateEmail, validateContactName, validateContactMessage } from "./validation-schema";

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
  const errors: string[] = [];

  if (!validateContactName(data.name)) {
    if (data.name.trim().length < 2) {
      errors.push("Name muss mindestens 2 Zeichen lang sein");
    } else {
      errors.push("Name darf maximal 100 Zeichen lang sein");
    }
  }

  if (!validateEmail(data.email)) {
    errors.push("Bitte geben Sie eine gültige E-Mail-Adresse ein");
  }

  if (!validateContactMessage(data.message)) {
    if (data.message.trim().length < 10) {
      errors.push("Nachricht muss mindestens 10 Zeichen lang sein");
    } else {
      errors.push("Nachricht darf maximal 2000 Zeichen lang sein");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

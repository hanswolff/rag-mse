import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  hasMinimumLength,
  hasUppercase,
  hasLowercase,
  hasDigit,
  getPasswordRequirements as getSharedPasswordRequirements,
} from "./validation-schema";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (typeof password !== "string") {
    return { isValid: false, errors: ["Passwort ist erforderlich"] };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Passwort darf maximal ${MAX_PASSWORD_LENGTH} Zeichen lang sein`);
  }

  if (!hasMinimumLength(password)) {
    errors.push(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein`);
  }

  if (!hasUppercase(password)) {
    errors.push("Passwort muss mindestens einen Großbuchstaben enthalten");
  }

  if (!hasLowercase(password)) {
    errors.push("Passwort muss mindestens einen Kleinbuchstaben enthalten");
  }

  if (!hasDigit(password)) {
    errors.push("Passwort muss mindestens eine Ziffer enthalten");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordRequirements(): string[] {
  return getSharedPasswordRequirements();
}

import { z } from "zod";
import type { FieldValidationConfig } from "./field-config";
import { requiredEmailSchema } from "./core";

// Password validation requirements
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export function createPasswordSchema(requiredMessage: string) {
  return z
    .string()
    .min(1, requiredMessage)
    .max(MAX_PASSWORD_LENGTH, `Passwort darf maximal ${MAX_PASSWORD_LENGTH} Zeichen lang sein`)
    .superRefine((value, ctx) => {
      if (value.length < MIN_PASSWORD_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein`,
        });
      }
      if (!/[A-Z]/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwort muss mindestens einen Großbuchstaben enthalten" });
      }
      if (!/[a-z]/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwort muss mindestens einen Kleinbuchstaben enthalten" });
      }
      if (!/[0-9]/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwort muss mindestens eine Ziffer enthalten" });
      }
    });
}

const requiredPasswordSchema = createPasswordSchema("Passwort ist erforderlich");

export const hasMinimumLength = (password: string): boolean => password.length >= MIN_PASSWORD_LENGTH;
export const hasUppercase = (password: string): boolean => /[A-Z]/.test(password);
export const hasLowercase = (password: string): boolean => /[a-z]/.test(password);
export const hasDigit = (password: string): boolean => /[0-9]/.test(password);

export const validatePassword = (password: string): boolean => {
  if (typeof password !== "string") return false;
  return requiredPasswordSchema.safeParse(password).success;
};

export const getPasswordRequirements = (): string[] => [
  `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`,
  "Mindestens ein Großbuchstabe",
  "Mindestens ein Kleinbuchstabe",
  "Mindestens eine Ziffer",
];

export const passwordChangeFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich"),
    newPassword: createPasswordSchema("Neues Passwort ist erforderlich"),
    confirmPassword: z.string().min(1, "Passwortbestätigung ist erforderlich"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Neues Passwort und Passwortbestätigung stimmen nicht überein",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Neues Passwort muss vom aktuellen Passwort abweichen",
    path: ["newPassword"],
  });

export const loginFormSchema = z.object({
  email: requiredEmailSchema("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export const forgotPasswordFormSchema = z.object({
  email: requiredEmailSchema("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

export const resetPasswordFormSchema = z
  .object({
    password: createPasswordSchema("Passwort ist erforderlich"),
    confirmPassword: z.string().min(1, "Passwortbestätigung ist erforderlich"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Die Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export const passwordChangeValidationConfig: Record<string, FieldValidationConfig> = {
  currentPassword: { zod: z.string().min(1, "Aktuelles Passwort ist erforderlich") },
  newPassword: { zod: createPasswordSchema("Neues Passwort ist erforderlich") },
  confirmPassword: { zod: z.string().min(1, "Passwortbestätigung ist erforderlich") },
};

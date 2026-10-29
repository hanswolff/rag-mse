import { z } from "zod";

// Email validation
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation
export const phoneRegex = /^[0-9+()\s-]+$/;

// Name validation
export const nameRegex = /^[a-zA-ZäöüÄÖÜß\s\-'.]+$/;

// Time validation (requires HH:MM format with leading zeros)
export const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(date: string): boolean {
  const match = isoDateRegex.exec(date);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const constructed = new Date(year, month - 1, day);
  return (
    constructed.getFullYear() === year &&
    constructed.getMonth() === month - 1 &&
    constructed.getDate() === day
  );
}

export const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "Name ist erforderlich")
  .max(100, "Name darf maximal 100 Zeichen lang sein")
  .regex(nameRegex, "Name enthält ungültige Zeichen");

export const requiredEmailSchema = (invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, "E-Mail ist erforderlich")
    .regex(emailRegex, invalidMessage);

export const optionalAddressSchema = z
  .string()
  .trim()
  .refine((value) => value.length <= 200, {
    message: "Adresse darf maximal 200 Zeichen lang sein",
  });

export const optionalPhoneSchema = (invalidCharsMessage: string) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) return;
      if (value.length > 30) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telefonnummer darf maximal 30 Zeichen lang sein" });
        return;
      }
      if (!phoneRegex.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: invalidCharsMessage });
      }
    });

export const requiredDateSchema = z
  .string()
  .trim()
  .min(1, "Datum ist erforderlich")
  .refine((value) => isValidIsoDate(value), {
    message: "Datum ist ungültig",
  });

export const requiredTitleSchema = z
  .string()
  .trim()
  .min(1, "Titel ist erforderlich")
  .max(200, "Titel darf maximal 200 Zeichen haben");

export function createCoordinateSchema(min: number, max: number, label: string, required = false) {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) {
        if (required) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} ist erforderlich` });
        }
        return;
      }
      if (!/^-?\d*\.?\d*$/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiger ${label}` });
        return;
      }
      const num = Number.parseFloat(value);
      if (Number.isNaN(num) || num < min || num > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiger ${label} (muss zwischen ${min} und ${max} liegen)` });
      }
    });
}

export const optionalLatitudeSchema = createCoordinateSchema(-90, 90, "Breitengrad");
export const optionalLongitudeSchema = createCoordinateSchema(-180, 180, "Längengrad");

// Einzige E-Mail-Kernprüfung (emailRegex). lib/user-validation.validateEmail leitet
// daraus die {isValid,error}-Variante ab (mit trim + Pflichtfeld-Meldung); diese
// boolean-Variante prüft bewusst ohne trim (Login/Passwort-vergessen).
export const validateEmail = (email: string): boolean => {
  if (typeof email !== "string") return false;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  if (typeof phone !== "string") return false;
  return optionalPhoneSchema("Telefonnummer enthält ungültige Zeichen").safeParse(phone).success;
};

export const validateAddress = (address: string): boolean => {
  if (typeof address !== "string") return false;
  return optionalAddressSchema.safeParse(address).success;
};

export const validateName = (name: string): boolean => {
  if (typeof name !== "string") return false;
  return requiredNameSchema.safeParse(name).success;
};

export const validateDateString = (date: string): boolean => {
  if (typeof date !== "string") return false;
  return isValidIsoDate(date);
};

export const validateTimeString = (time: string): boolean => {
  if (typeof time !== "string") return false;
  return timeRegex.test(time);
};

export const validateTitle = (title: string): boolean => {
  if (typeof title !== "string") return false;
  return requiredTitleSchema.safeParse(title).success;
};

export const validateLatitude = (latitude: string): boolean => {
  if (typeof latitude !== "string") return false;
  return optionalLatitudeSchema.safeParse(latitude).success;
};

export const validateLongitude = (longitude: string): boolean => {
  if (typeof longitude !== "string") return false;
  return optionalLongitudeSchema.safeParse(longitude).success;
};

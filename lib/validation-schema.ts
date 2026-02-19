import { z } from "zod";
import { FieldValidationConfig } from "./useFormFieldValidation";
import {
  MAX_EVENT_DESCRIPTION_BYTES,
  hasEventDescriptionContent,
  isEventDescriptionWithinLimit,
} from "./event-description";

// Email validation
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation
export const phoneRegex = /^[0-9+()\s-]+$/;

// Name validation
export const nameRegex = /^[a-zA-ZäöüÄÖÜß\s\-'.]+$/;

// Time validation
export const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidIsoDate(date: string): boolean {
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

const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "Name ist erforderlich")
  .max(100, "Name darf maximal 100 Zeichen lang sein")
  .regex(nameRegex, "Name enthält ungültige Zeichen");

const requiredEmailSchema = (invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, "E-Mail ist erforderlich")
    .regex(emailRegex, invalidMessage);

const optionalAddressSchema = z
  .string()
  .trim()
  .refine((value) => value.length <= 200, {
    message: "Adresse darf maximal 200 Zeichen lang sein",
  });

const optionalPhoneSchema = (invalidCharsMessage: string) =>
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

const optionalIsoDateSchema = z
  .string()
  .trim()
  .refine((value) => !value || isValidIsoDate(value), {
    message: "Ungültiges Datum",
  });

const optionalDateOfBirthSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value) return;
    if (!isValidIsoDate(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiges Geburtsdatum" });
      return;
    }
    const date = new Date(value);
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());

    if (date > now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Geburtsdatum darf nicht in der Zukunft liegen" });
      return;
    }

    if (date < minDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiges Geburtsdatum" });
    }
  });

const optionalRankSchema = z.string().trim().max(30, "Dienstgrad darf maximal 30 Zeichen lang sein");
const optionalPkSchema = z.string().trim().max(20, "PK darf maximal 20 Zeichen lang sein");
const optionalReservistsAssociationSchema = z
  .string()
  .trim()
  .max(30, "Reservistenkameradschaft darf maximal 30 Zeichen lang sein");
const optionalAssociationMemberNumberSchema = z
  .string()
  .trim()
  .max(30, "Mitgliedsnummer im Verband darf maximal 30 Zeichen lang sein");

const optionalAdminNotesSchema = z
  .string()
  .trim()
  .max(4000, "Administratoren-Notizen dürfen maximal 4000 Zeichen lang sein");

const requiredDateSchema = z
  .string()
  .trim()
  .min(1, "Datum ist erforderlich")
  .refine((value) => isValidIsoDate(value), {
    message: "Datum ist ungültig",
  });

const requiredTimeSchema = (requiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(timeRegex, "Ungültiges Zeitformat");

const requiredLocationSchema = z
  .string()
  .trim()
  .min(1, "Ort ist erforderlich")
  .max(200, "Ort darf maximal 200 Zeichen haben");

const requiredDescriptionSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (!hasEventDescriptionContent(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Beschreibung ist erforderlich" });
      return;
    }

    if (!isEventDescriptionWithinLimit(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`,
      });
    }
  });

const optionalLatitudeSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value) return;
    if (!/^-?\d*\.?\d*$/.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiger Breitengrad" });
      return;
    }
    const num = Number.parseFloat(value);
    if (Number.isNaN(num) || num < -90 || num > 90) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)" });
    }
  });

const optionalLongitudeSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value) return;
    if (!/^-?\d*\.?\d*$/.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiger Längengrad" });
      return;
    }
    const num = Number.parseFloat(value);
    if (Number.isNaN(num) || num < -180 || num > 180) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiger Längengrad (muss zwischen -180 und 180 liegen)" });
    }
  });

const requiredTitleSchema = z
  .string()
  .trim()
  .min(1, "Titel ist erforderlich")
  .max(200, "Titel darf maximal 200 Zeichen haben");

const requiredContentSchema = z
  .string()
  .trim()
  .min(1, "Inhalt ist erforderlich")
  .max(10000, "Inhalt darf maximal 10000 Zeichen haben");

const optionalDocumentDisplayNameSchema = z
  .string()
  .superRefine((value, ctx) => {
    const normalized = value.trim();
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dokumentenname darf nicht leer sein" });
      return;
    }

    if (normalized.length > 200) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dokumentenname darf maximal 200 Zeichen lang sein" });
    }
  });

const optionalDocumentDateSchema = z
  .string()
  .trim()
  .refine((value) => !value || isValidIsoDate(value), {
    message: "Ungültiges Dokumentdatum",
  });

const requiredContactNameSchema = z
  .string()
  .trim()
  .min(2, "Name muss mindestens 2 Zeichen lang sein")
  .max(100, "Name darf maximal 100 Zeichen lang sein")
  .regex(nameRegex, "Name enthält ungültige Zeichen");

const requiredMessageSchema = z
  .string()
  .trim()
  .min(10, "Nachricht muss mindestens 10 Zeichen lang sein")
  .max(2000, "Nachricht darf maximal 2000 Zeichen lang sein");

// Password validation requirements
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

function createPasswordSchema(requiredMessage: string) {
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

export const validateLocation = (location: string): boolean => {
  if (typeof location !== "string") return false;
  return requiredLocationSchema.safeParse(location).success;
};

export const validateDescription = (description: string): boolean => {
  if (typeof description !== "string") return false;
  return requiredDescriptionSchema.safeParse(description).success;
};

export const validateTitle = (title: string): boolean => {
  if (typeof title !== "string") return false;
  return requiredTitleSchema.safeParse(title).success;
};

export const validateContent = (content: string): boolean => {
  if (typeof content !== "string") return false;
  return requiredContentSchema.safeParse(content).success;
};

export const validateLatitude = (latitude: string): boolean => {
  if (typeof latitude !== "string") return false;
  return optionalLatitudeSchema.safeParse(latitude).success;
};

export const validateLongitude = (longitude: string): boolean => {
  if (typeof longitude !== "string") return false;
  return optionalLongitudeSchema.safeParse(longitude).success;
};

export const validateContactName = (name: string): boolean => {
  if (typeof name !== "string") return false;
  return requiredContactNameSchema.safeParse(name).success;
};

export const validateContactMessage = (message: string): boolean => {
  if (typeof message !== "string") return false;
  return requiredMessageSchema.safeParse(message).success;
};

export const validatePassword = (password: string): boolean => {
  if (typeof password !== "string") return false;
  return requiredPasswordSchema.safeParse(password).success;
};

export const getPasswordRequirements = (): string[] => [
  `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`,
  `Maximal ${MAX_PASSWORD_LENGTH} Zeichen`,
  "Mindestens ein Großbuchstabe",
  "Mindestens ein Kleinbuchstabe",
  "Mindestens eine Ziffer",
];

// Event type validation
export const EVENT_TYPES = ["Training", "Wettkampf"] as const;
export const validateEventType = (type: string): boolean => {
  if (!type || type.trim() === "") return true;
  return EVENT_TYPES.includes(type as (typeof EVENT_TYPES)[number]);
};

// Role validation
export const VALID_ROLES = ["ADMIN", "MEMBER"] as const;
export const validateRole = (role: string): boolean => {
  if (typeof role !== "string") return false;
  return VALID_ROLES.includes(role as (typeof VALID_ROLES)[number]);
};

const requiredRoleSchema = z
  .string()
  .trim()
  .refine((value) => validateRole(value), { message: "Ungültige Rolle" });

// Shared Zod object schemas for frontend + API
export const profileFormSchema = z.object({
  name: requiredNameSchema,
  email: requiredEmailSchema("E-Mail hat ungültiges Format"),
  address: optionalAddressSchema,
  phone: optionalPhoneSchema("Telefonnummer hat ungültiges Format"),
  dateOfBirth: optionalDateOfBirthSchema,
  rank: optionalRankSchema,
  pk: optionalPkSchema,
  reservistsAssociation: optionalReservistsAssociationSchema,
  associationMemberNumber: optionalAssociationMemberNumberSchema,
  memberSince: optionalIsoDateSchema,
});

export const invitationProfileFormSchema = profileFormSchema.omit({ email: true, memberSince: true });

export const contactFormSchema = z.object({
  name: requiredContactNameSchema,
  email: requiredEmailSchema("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  message: requiredMessageSchema,
});

export const eventFormSchema = z
  .object({
    date: requiredDateSchema,
    timeFrom: requiredTimeSchema("Uhrzeit von ist erforderlich"),
    timeTo: requiredTimeSchema("Uhrzeit bis ist erforderlich"),
    location: requiredLocationSchema,
    description: requiredDescriptionSchema,
    latitude: optionalLatitudeSchema,
    longitude: optionalLongitudeSchema,
  })
  .refine(
    (data) => {
      if (data.timeFrom && data.timeTo) {
        const [h1, m1] = data.timeFrom.split(":").map(Number);
        const [h2, m2] = data.timeTo.split(":").map(Number);
        return h1 * 60 + m1 < h2 * 60 + m2;
      }
      return true;
    },
    {
      message: "Uhrzeit bis muss nach Uhrzeit von liegen",
      path: ["timeTo"],
    }
  );

export const newsFormSchema = z.object({
  newsDate: requiredDateSchema,
  title: requiredTitleSchema,
  content: requiredContentSchema,
});

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

// Validation configurations for useFormFieldValidation hook (simplified format)
export const userValidationConfig: Record<string, FieldValidationConfig> = {
  email: { zod: requiredEmailSchema("E-Mail hat ungültiges Format") },
  name: { zod: requiredNameSchema },
  address: { zod: optionalAddressSchema },
  phone: { zod: optionalPhoneSchema("Telefonnummer hat ungültiges Format") },
};

export const eventValidationConfig: Record<string, FieldValidationConfig> = {
  date: { zod: requiredDateSchema },
  timeFrom: { zod: requiredTimeSchema("Uhrzeit von ist erforderlich") },
  timeTo: { zod: requiredTimeSchema("Uhrzeit bis ist erforderlich") },
  location: { zod: requiredLocationSchema },
  description: { zod: requiredDescriptionSchema },
  latitude: { zod: optionalLatitudeSchema },
  longitude: { zod: optionalLongitudeSchema },
};

export const newsValidationConfig: Record<string, FieldValidationConfig> = {
  newsDate: { zod: requiredDateSchema },
  title: { zod: requiredTitleSchema },
  content: { zod: requiredContentSchema },
};

export const documentValidationConfig: Record<string, FieldValidationConfig> = {
  displayName: { zod: optionalDocumentDisplayNameSchema },
  documentDate: { zod: optionalDocumentDateSchema },
};

export const contactValidationConfig: Record<string, FieldValidationConfig> = {
  name: { zod: requiredContactNameSchema },
  email: { zod: requiredEmailSchema("Bitte geben Sie eine gültige E-Mail-Adresse ein") },
  message: { zod: requiredMessageSchema },
};

export const passwordChangeValidationConfig: Record<string, FieldValidationConfig> = {
  currentPassword: { zod: z.string().min(1, "Aktuelles Passwort ist erforderlich") },
  newPassword: { zod: createPasswordSchema("Neues Passwort ist erforderlich") },
  confirmPassword: { zod: z.string().min(1, "Passwortbestätigung ist erforderlich") },
};

export const profileValidationConfig: Record<string, FieldValidationConfig> = {
  name: { zod: requiredNameSchema },
  email: { zod: requiredEmailSchema("E-Mail hat ungültiges Format") },
  address: { zod: optionalAddressSchema },
  phone: { zod: optionalPhoneSchema("Telefonnummer hat ungültiges Format") },
  dateOfBirth: { zod: optionalDateOfBirthSchema },
  rank: { zod: optionalRankSchema },
  pk: { zod: optionalPkSchema },
  reservistsAssociation: { zod: optionalReservistsAssociationSchema },
  associationMemberNumber: { zod: optionalAssociationMemberNumberSchema },
  memberSince: { zod: optionalIsoDateSchema },
};

export const adminUserValidationConfig: Record<string, FieldValidationConfig> = {
  ...profileValidationConfig,
  role: { zod: requiredRoleSchema },
  adminNotes: { zod: optionalAdminNotesSchema },
};

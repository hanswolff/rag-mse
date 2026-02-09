import { FieldValidationConfig } from "./useFormFieldValidation";
import {
  MAX_EVENT_DESCRIPTION_BYTES,
  hasEventDescriptionContent,
  isEventDescriptionWithinLimit,
} from "./event-description";

// Email validation
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (email: string): boolean => {
  if (typeof email !== "string") return false;
  return emailRegex.test(email);
};

// Phone validation
export const phoneRegex = /^[0-9+()\s-]+$/;

export const validatePhone = (phone: string): boolean => {
  if (typeof phone !== "string") return false;
  const trimmed = phone.trim();
  if (!trimmed) return true;
  return trimmed.length <= 30 && phoneRegex.test(trimmed);
};

// Address validation
export const validateAddress = (address: string): boolean => {
  if (typeof address !== "string") return false;
  const trimmed = address.trim();
  if (!trimmed) return true;
  return trimmed.length <= 200;
};

// Name validation
export const nameRegex = /^[a-zA-ZäöüÄÖÜß\s\-'.]+$/;

export const validateName = (name: string): boolean => {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100 && nameRegex.test(trimmed);
};

// Date validation
export const validateDateString = (date: string): boolean => {
  if (typeof date !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
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
};

// Time validation
export const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const validateTimeString = (time: string): boolean => {
  if (typeof time !== "string") return false;
  return timeRegex.test(time);
};

// Location validation
export const validateLocation = (location: string): boolean => {
  if (typeof location !== "string") return false;
  return location.trim().length > 0 && location.trim().length <= 200;
};

export const validateDescription = (description: string): boolean => {
  if (typeof description !== "string") return false;
  return hasEventDescriptionContent(description) && isEventDescriptionWithinLimit(description);
};

// Title validation (for news)
export const validateTitle = (title: string): boolean => {
  if (typeof title !== "string") return false;
  return title.trim().length > 0 && title.trim().length <= 200;
};

// Content validation (for news)
export const validateContent = (content: string): boolean => {
  if (typeof content !== "string") return false;
  return content.trim().length > 0 && content.trim().length <= 10000;
};

// Coordinate validation
export const validateLatitude = (latitude: string): boolean => {
  if (typeof latitude !== "string") return false;
  if (!latitude || latitude.trim() === "") return true;
  const num = parseFloat(latitude);
  return !isNaN(num) && num >= -90 && num <= 90;
};

export const validateLongitude = (longitude: string): boolean => {
  if (typeof longitude !== "string") return false;
  if (!longitude || longitude.trim() === "") return true;
  const num = parseFloat(longitude);
  return !isNaN(num) && num >= -180 && num <= 180;
};

// Contact form validation
export const validateContactName = (name: string): boolean => {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
};

export const validateContactMessage = (message: string): boolean => {
  if (typeof message !== "string") return false;
  const trimmed = message.trim();
  return trimmed.length >= 10 && trimmed.length <= 2000;
};

// Password validation requirements
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export const hasMinimumLength = (password: string): boolean => {
  return password.length >= MIN_PASSWORD_LENGTH;
};

export const hasUppercase = (password: string): boolean => {
  return /[A-Z]/.test(password);
};

export const hasLowercase = (password: string): boolean => {
  return /[a-z]/.test(password);
};

export const hasDigit = (password: string): boolean => {
  return /[0-9]/.test(password);
};

export const validatePassword = (password: string): boolean => {
  if (typeof password !== "string") return false;
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  return (
    hasMinimumLength(password) &&
    hasUppercase(password) &&
    hasLowercase(password) &&
    hasDigit(password)
  );
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
  return EVENT_TYPES.includes(type as typeof EVENT_TYPES[number]);
};

// Role validation
export const VALID_ROLES = ["ADMIN", "MEMBER"] as const;
export const validateRole = (role: string): boolean => {
  if (typeof role !== "string") return false;
  return VALID_ROLES.includes(role as typeof VALID_ROLES[number]);
};

// Validation configurations for useFormFieldValidation hook
export const userValidationConfig: Record<string, FieldValidationConfig> = {
  email: {
    rules: {
      required: true,
      pattern: emailRegex,
    },
    errorMessages: {
      required: "E-Mail ist erforderlich",
      pattern: "E-Mail hat ungültiges Format",
    },
  },
  name: {
    rules: {
      required: true,
      pattern: nameRegex,
      maxLength: 100,
    },
    errorMessages: {
      required: "Name ist erforderlich",
      pattern: "Name enthält ungültige Zeichen",
      maxLength: "Name darf maximal 100 Zeichen haben",
    },
  },
  address: {
    rules: {
      maxLength: 200,
    },
    errorMessages: {
      maxLength: "Adresse darf maximal 200 Zeichen haben",
    },
  },
  phone: {
    rules: {
      pattern: phoneRegex,
    },
    errorMessages: {
      pattern: "Telefonnummer hat ungültiges Format",
    },
  },
};

export const eventValidationConfig: Record<string, FieldValidationConfig> = {
  date: {
    rules: {
      required: true,
    },
    errorMessages: {
      required: "Datum ist erforderlich",
    },
  },
  timeFrom: {
    rules: {
      required: true,
      pattern: timeRegex,
    },
    errorMessages: {
      required: "Uhrzeit von ist erforderlich",
      pattern: "Ungültiges Zeitformat",
    },
  },
  timeTo: {
    rules: {
      required: true,
      pattern: timeRegex,
    },
    errorMessages: {
      required: "Uhrzeit bis ist erforderlich",
      pattern: "Ungültiges Zeitformat",
    },
  },
  location: {
    rules: {
      required: true,
      maxLength: 200,
    },
    errorMessages: {
      required: "Ort ist erforderlich",
      maxLength: "Ort darf maximal 200 Zeichen haben",
    },
  },
  description: {
    rules: {
      required: true,
      customValidator: (value: string) => {
        if (!hasEventDescriptionContent(value)) {
          return "Beschreibung ist erforderlich";
        }

        if (!isEventDescriptionWithinLimit(value)) {
          return `Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`;
        }

        return null;
      },
    },
    errorMessages: {
      required: "Beschreibung ist erforderlich",
      custom: "Beschreibung hat ungültigen Inhalt",
    },
  },
  latitude: {
    rules: {
      pattern: /^-?\d*\.?\d*$/,
      customValidator: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (!validateLatitude(trimmed)) return "Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)";
        return null;
      },
    },
    errorMessages: {
      pattern: "Ungültiger Breitengrad",
      custom: "Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)",
    },
  },
  longitude: {
    rules: {
      pattern: /^-?\d*\.?\d*$/,
      customValidator: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (!validateLongitude(trimmed)) return "Ungültiger Längengrad (muss zwischen -180 und 180 liegen)";
        return null;
      },
    },
    errorMessages: {
      pattern: "Ungültiger Längengrad",
      custom: "Ungültiger Längengrad (muss zwischen -180 und 180 liegen)",
    },
  },
};

export const newsValidationConfig: Record<string, FieldValidationConfig> = {
  title: {
    rules: {
      required: true,
      maxLength: 200,
    },
    errorMessages: {
      required: "Titel ist erforderlich",
      maxLength: "Titel darf maximal 200 Zeichen haben",
    },
  },
  content: {
    rules: {
      required: true,
      maxLength: 10000,
    },
    errorMessages: {
      required: "Inhalt ist erforderlich",
      maxLength: "Inhalt darf maximal 10000 Zeichen haben",
    },
  },
};

export const contactValidationConfig: Record<string, FieldValidationConfig> = {
  name: {
    rules: {
      required: true,
      pattern: nameRegex,
      minLength: 2,
      maxLength: 100,
    },
    errorMessages: {
      required: "Name ist erforderlich",
      pattern: "Name enthält ungültige Zeichen",
      minLength: "Name muss mindestens 2 Zeichen lang sein",
      maxLength: "Name darf maximal 100 Zeichen haben",
    },
  },
  email: {
    rules: {
      required: true,
      pattern: emailRegex,
    },
    errorMessages: {
      required: "E-Mail ist erforderlich",
      pattern: "Bitte geben Sie eine gültige E-Mail-Adresse ein",
    },
  },
  message: {
    rules: {
      required: true,
      minLength: 10,
      maxLength: 2000,
    },
    errorMessages: {
      required: "Nachricht ist erforderlich",
      minLength: "Nachricht muss mindestens 10 Zeichen lang sein",
      maxLength: "Nachricht darf maximal 2000 Zeichen haben",
    },
  },
};

export const passwordChangeValidationConfig: Record<string, FieldValidationConfig> = {
  currentPassword: {
    rules: {
      required: true,
    },
    errorMessages: {
      required: "Aktuelles Passwort ist erforderlich",
    },
  },
  newPassword: {
    rules: {
      required: true,
      minLength: MIN_PASSWORD_LENGTH,
      maxLength: MAX_PASSWORD_LENGTH,
      customValidator: (value: string) => {
        if (!hasMinimumLength(value)) {
          return `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein`;
        }
        if (!hasUppercase(value)) {
          return "Passwort muss mindestens einen Großbuchstaben enthalten";
        }
        if (!hasLowercase(value)) {
          return "Passwort muss mindestens einen Kleinbuchstaben enthalten";
        }
        if (!hasDigit(value)) {
          return "Passwort muss mindestens eine Ziffer enthalten";
        }
        return null;
      },
    },
    errorMessages: {
      required: "Neues Passwort ist erforderlich",
      minLength: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein`,
      maxLength: `Passwort darf maximal ${MAX_PASSWORD_LENGTH} Zeichen lang sein`,
      custom: "Passwort erfüllt nicht die Anforderungen",
    },
  },
  confirmPassword: {
    rules: {
      required: true,
    },
    errorMessages: {
      required: "Passwortbestätigung ist erforderlich",
    },
  },
};

export const profileValidationConfig: Record<string, FieldValidationConfig> = {
  name: {
    rules: {
      required: true,
      pattern: nameRegex,
      maxLength: 100,
    },
    errorMessages: {
      required: "Name ist erforderlich",
      pattern: "Name enthält ungültige Zeichen",
      maxLength: "Name darf maximal 100 Zeichen haben",
    },
  },
  email: {
    rules: {
      required: true,
      pattern: emailRegex,
    },
    errorMessages: {
      required: "E-Mail ist erforderlich",
      pattern: "E-Mail hat ungültiges Format",
    },
  },
  address: {
    rules: {
      maxLength: 200,
    },
    errorMessages: {
      maxLength: "Adresse darf maximal 200 Zeichen haben",
    },
  },
  phone: {
    rules: {
      pattern: phoneRegex,
    },
    errorMessages: {
      pattern: "Telefonnummer hat ungültiges Format",
    },
  },
  dateOfBirth: {
    rules: {
      customValidator: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (!validateDateString(trimmed)) return "Ungültiges Geburtsdatum";
        const date = new Date(trimmed);
        const now = new Date();
        const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
        if (date > now) return "Geburtsdatum darf nicht in der Zukunft liegen";
        if (date < minDate) return "Ungültiges Geburtsdatum";
        return null;
      },
    },
    errorMessages: {
      custom: "Ungültiges Geburtsdatum",
    },
  },
  rank: {
    rules: {
      maxLength: 30,
    },
    errorMessages: {
      maxLength: "Dienstgrad darf maximal 30 Zeichen haben",
    },
  },
  pk: {
    rules: {
      maxLength: 20,
    },
    errorMessages: {
      maxLength: "PK darf maximal 20 Zeichen haben",
    },
  },
  memberSince: {
    rules: {
      customValidator: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (!validateDateString(trimmed)) return "Ungültiges Datum";
        return null;
      },
    },
    errorMessages: {
      custom: "Ungültiges Datum",
    },
  },
};

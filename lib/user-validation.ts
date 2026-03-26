import { Role } from "@prisma/client";
import { z } from "zod";
import {
  validateEmail as validateEmailFormat,
  validatePhone as validatePhoneFormat,
  nameRegex,
  emailRegex,
  validateDateString,
  profileFormSchema,
  passwordChangeFormSchema,
  createPasswordSchema,
} from "./validation-schema";
import { zodToValidationResult } from "./validation-context";
import type { FieldError } from "./server-error-mapper";

// Re-export for backward compatibility with API routes
export { validateEmail as validateEmailFormat } from "./validation-schema";

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface UpdateProfileRequest {
  email?: string;
  name?: string;
  address?: string;
  phone?: string;
  memberSince?: string;
  dateOfBirth?: string;
  rank?: string;
  pk?: string;
  reservistsAssociation?: string;
  associationMemberNumber?: string;
  hasPossessionCard?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (typeof email !== "string") {
    return { isValid: false, error: "Ungültige E-Mail-Adresse" };
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: "E-Mail ist erforderlich" };
  }
  if (!validateEmailFormat(trimmed)) {
    return { isValid: false, error: "Ungültiges E-Mail-Format" };
  }
  return { isValid: true };
}

export function validatePhone(phone: string): { isValid: boolean; error?: string } {
  const isValid = validatePhoneFormat(phone);
  if (isValid) {
    return { isValid: true };
  }
  if (typeof phone !== "string") {
    return { isValid: false, error: "Ungültige Telefonnummer" };
  }
  const trimmed = phone.trim();
  if (trimmed.length > 30) {
    return { isValid: false, error: "Telefonnummer darf maximal 30 Zeichen lang sein" };
  }
  return { isValid: false, error: "Telefonnummer enthält ungültige Zeichen" };
}

export function validateName(name: string): { isValid: boolean; error?: string } {
  if (typeof name !== "string") {
    return { isValid: false, error: "Ungültiger Name" };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: "Name ist erforderlich" };
  }
  if (trimmed.length > 100) {
    return { isValid: false, error: "Name darf maximal 100 Zeichen lang sein" };
  }
  if (!nameRegex.test(trimmed)) {
    return { isValid: false, error: "Name enthält ungültige Zeichen" };
  }
  return { isValid: true };
}

export function validateAddress(address: string): { isValid: boolean; error?: string } {
  if (typeof address !== "string") {
    return { isValid: false, error: "Ungültige Adresse" };
  }
  const trimmed = address.trim();
  if (trimmed.length > 200) {
    return { isValid: false, error: "Adresse darf maximal 200 Zeichen lang sein" };
  }
  return { isValid: true };
}

export function normalizeOptionalField(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function validateTextMaxLength(
  value: string,
  maxLength: number,
  invalidMessage: string,
  maxLengthMessage: string
): { isValid: boolean; error?: string } {
  if (typeof value !== "string") {
    return { isValid: false, error: invalidMessage };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: true };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: maxLengthMessage };
  }

  return { isValid: true };
}

/**
 * Field configuration for creating validators
 * Reduces DRY violations by using a configuration-based approach
 */
interface TextFieldConfig {
  maxLength: number;
  invalidMessage: string;
  maxLengthMessage: string;
}

const TEXT_FIELD_CONFIGS: Record<string, TextFieldConfig> = {
  rank: {
    maxLength: 30,
    invalidMessage: "Ungültiger Dienstgrad",
    maxLengthMessage: "Dienstgrad darf maximal 30 Zeichen lang sein",
  },
  pk: {
    maxLength: 20,
    invalidMessage: "Ungültige PK",
    maxLengthMessage: "PK darf maximal 20 Zeichen lang sein",
  },
  reservistsAssociation: {
    maxLength: 30,
    invalidMessage: "Ungültige Reservistenkameradschaft",
    maxLengthMessage: "Reservistenkameradschaft darf maximal 30 Zeichen lang sein",
  },
  associationMemberNumber: {
    maxLength: 30,
    invalidMessage: "Ungültige Mitgliedsnummer im Verband",
    maxLengthMessage: "Mitgliedsnummer im Verband darf maximal 30 Zeichen lang sein",
  },
  adminNotes: {
    maxLength: 4000,
    invalidMessage: "Ungültige Administratoren-Notizen",
    maxLengthMessage: "Administratoren-Notizen dürfen maximal 4000 Zeichen lang sein",
  },
};

/**
 * Factory function to create a text max-length validator
 */
function createTextValidator(config: TextFieldConfig) {
  return (value: string): { isValid: boolean; error?: string } =>
    validateTextMaxLength(value, config.maxLength, config.invalidMessage, config.maxLengthMessage);
}

// Generated validators from configuration
export const validateRank = createTextValidator(TEXT_FIELD_CONFIGS.rank);
export const validatePk = createTextValidator(TEXT_FIELD_CONFIGS.pk);
export const validateReservistsAssociation = createTextValidator(TEXT_FIELD_CONFIGS.reservistsAssociation);
export const validateAssociationMemberNumber = createTextValidator(TEXT_FIELD_CONFIGS.associationMemberNumber);
export const validateAdminNotes = createTextValidator(TEXT_FIELD_CONFIGS.adminNotes);

export function validateDateOfBirth(value: string): { isValid: boolean; error?: string } {
  if (typeof value !== "string") {
    return { isValid: false, error: "Ungültiges Geburtsdatum" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: true };
  }

  if (!validateDateString(trimmed)) {
    return { isValid: false, error: "Ungültiges Geburtsdatum" };
  }

  const date = new Date(trimmed);
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());

  if (date > now) {
    return { isValid: false, error: "Geburtsdatum darf nicht in der Zukunft liegen" };
  }

  if (date < minDate) {
    return { isValid: false, error: "Ungültiges Geburtsdatum" };
  }

  return { isValid: true };
}

// Server-side schemas using superRefine for early-exit (returns only the first error per field).
// Client-side schemas (requiredEmailSchema/requiredNameSchema in validation-schema.ts) use
// chained validators that report all errors at once for inline form feedback.
const sequentialEmailSchema = z.string().trim().superRefine((val, ctx) => {
  if (val.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "E-Mail ist erforderlich" });
    return;
  }
  if (!emailRegex.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiges E-Mail-Format" });
  }
});

const sequentialNameSchema = z.string().trim().superRefine((val, ctx) => {
  if (val.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name ist erforderlich" });
    return;
  }
  if (val.length > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name darf maximal 100 Zeichen lang sein" });
    return;
  }
  if (!nameRegex.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name enthält ungültige Zeichen" });
  }
});

const createUserSchema = z.object({
  email: sequentialEmailSchema,
  name: sequentialNameSchema,
  password: createPasswordSchema("Passwort ist erforderlich"),
  role: z.string()
    .refine((v) => Object.values(Role).includes(v as Role), { message: "Ungültige Rolle" })
    .optional(),
});

export function validateCreateUserRequest(request: CreateUserRequest) {
  return zodToValidationResult(createUserSchema.safeParse(request));
}

export function validateUpdateProfileRequest(request: UpdateProfileRequest) {
  if (request.hasPossessionCard !== undefined && typeof request.hasPossessionCard !== "boolean") {
    return {
      isValid: false,
      errors: ["Ungültiger Wert für Waffenbesitzkarte"],
      fieldErrors: [{ field: "hasPossessionCard", message: "Ungültiger Wert für Waffenbesitzkarte" }] as FieldError[],
    };
  }

  const data: Record<string, string> = {};
  if (request.name !== undefined) data.name = request.name;
  if (request.email !== undefined) data.email = request.email;
  if (request.address !== undefined) data.address = request.address;
  if (request.phone !== undefined) data.phone = request.phone;
  if (request.dateOfBirth !== undefined) data.dateOfBirth = request.dateOfBirth;
  if (request.rank !== undefined) data.rank = request.rank;
  if (request.pk !== undefined) data.pk = request.pk;
  if (request.reservistsAssociation !== undefined) data.reservistsAssociation = request.reservistsAssociation;
  if (request.associationMemberNumber !== undefined) data.associationMemberNumber = request.associationMemberNumber;
  if (request.memberSince !== undefined) data.memberSince = request.memberSince;

  if (Object.keys(data).length === 0) {
    return { isValid: true, errors: [], fieldErrors: [] as FieldError[] };
  }

  return zodToValidationResult(profileFormSchema.partial().safeParse(data));
}

export function validateChangePasswordRequest(request: ChangePasswordRequest) {
  return zodToValidationResult(passwordChangeFormSchema.safeParse({
    currentPassword: request.currentPassword,
    newPassword: request.newPassword,
    confirmPassword: request.confirmPassword,
  }));
}

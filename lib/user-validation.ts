import { Role } from "@prisma/client";
import { z } from "zod";
import type { ZodType } from "zod";
import {
  nameRegex,
  emailRegex,
  optionalAddressSchema,
  optionalPhoneSchema,
  requiredEmailSchema,
  requiredNameSchema,
} from "./validation/core";
import {
  optionalAdminNotesSchema,
  optionalAssociationMemberNumberSchema,
  optionalDateOfBirthSchema,
  optionalPkSchema,
  optionalRankSchema,
  optionalReservistsAssociationSchema,
  profileFormSchema,
} from "./validation/profile";
import { createPasswordSchema, passwordChangeFormSchema } from "./validation/password";
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

// Leitet die {isValid,error}-Varianten aus den Zod-Feldschemata ab, damit Limits
// und Meldungen nur an einer Stelle (lib/validation/*) gepflegt werden. Die
// typeErrorMessage greift nur bei Nicht-String-Werten aus JSON-Bodies.
function createFieldValidator(schema: ZodType<string>, typeErrorMessage: string) {
  return (value: string): { isValid: boolean; error?: string } => {
    if (typeof value !== "string") {
      return { isValid: false, error: typeErrorMessage };
    }
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      return { isValid: true };
    }
    return { isValid: false, error: parsed.error.issues[0]?.message ?? typeErrorMessage };
  };
}

// Nutzt dieselbe emailRegex wie die boolean-Variante validateEmail aus
// lib/validation/core.ts; hier zusätzlich trim + eigene Pflichtfeld-Meldung.
export const validateEmail = createFieldValidator(
  requiredEmailSchema("Ungültiges E-Mail-Format"),
  "Ungültige E-Mail-Adresse"
);

export const validatePhone = createFieldValidator(
  optionalPhoneSchema("Telefonnummer enthält ungültige Zeichen"),
  "Ungültige Telefonnummer"
);

export const validateName = createFieldValidator(requiredNameSchema, "Ungültiger Name");
export const validateAddress = createFieldValidator(optionalAddressSchema, "Ungültige Adresse");

export function normalizeOptionalField(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export const validateRank = createFieldValidator(optionalRankSchema, "Ungültiger Dienstgrad");
export const validatePk = createFieldValidator(optionalPkSchema, "Ungültige PK");
export const validateReservistsAssociation = createFieldValidator(
  optionalReservistsAssociationSchema,
  "Ungültige Reservistenkameradschaft"
);
export const validateAssociationMemberNumber = createFieldValidator(
  optionalAssociationMemberNumberSchema,
  "Ungültige Mitgliedsnummer im Verband"
);
export const validateAdminNotes = createFieldValidator(
  optionalAdminNotesSchema,
  "Ungültige Administratoren-Notizen"
);
export const validateDateOfBirth = createFieldValidator(
  optionalDateOfBirthSchema,
  "Ungültiges Geburtsdatum"
);

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

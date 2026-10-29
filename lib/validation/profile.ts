import { z } from "zod";
import { ASSIGNABLE_ROLES } from "../permissions";
import type { FieldValidationConfig } from "./field-config";
import {
  isValidIsoDate,
  optionalAddressSchema,
  optionalPhoneSchema,
  requiredEmailSchema,
  requiredNameSchema,
} from "./core";

const optionalIsoDateSchema = z
  .string()
  .trim()
  .refine((value) => !value || isValidIsoDate(value), {
    message: "Ungültiges Datum",
  });

export const optionalDateOfBirthSchema = z
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

export const optionalRankSchema = z.string().trim().max(30, "Dienstgrad darf maximal 30 Zeichen lang sein");
export const optionalPkSchema = z.string().trim().max(20, "PK darf maximal 20 Zeichen lang sein");
export const optionalReservistsAssociationSchema = z
  .string()
  .trim()
  .max(30, "Reservistenkameradschaft darf maximal 30 Zeichen lang sein");
export const optionalAssociationMemberNumberSchema = z
  .string()
  .trim()
  .max(30, "Mitgliedsnummer im Verband darf maximal 30 Zeichen lang sein");

export const optionalAdminNotesSchema = z
  .string()
  .trim()
  .max(4000, "Administratoren-Notizen dürfen maximal 4000 Zeichen lang sein");

// Role validation
export const VALID_ROLES = ASSIGNABLE_ROLES;
export const validateRole = (role: string): boolean => {
  if (typeof role !== "string") return false;
  return VALID_ROLES.includes(role as (typeof VALID_ROLES)[number]);
};

const requiredRoleSchema = z
  .string()
  .trim()
  .refine((value) => validateRole(value), { message: "Ungültige Rolle" });

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

export const userValidationConfig: Record<string, FieldValidationConfig> = {
  email: { zod: requiredEmailSchema("E-Mail hat ungültiges Format") },
  name: { zod: requiredNameSchema },
  address: { zod: optionalAddressSchema },
  phone: { zod: optionalPhoneSchema("Telefonnummer hat ungültiges Format") },
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

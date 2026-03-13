import {
  validateAddress,
  validateAssociationMemberNumber,
  validateDateOfBirth,
  validatePhone,
  validatePk,
  validateRank,
  validateReservistsAssociation,
} from "@/lib/user-validation";
import { validateDateString } from "@/lib/validation-schema";

type OptionalText = string | null | undefined;

export type ProfileFieldValidationInput = {
  address?: OptionalText;
  phone?: OptionalText;
  memberSince?: OptionalText;
  dateOfBirth?: OptionalText;
  rank?: OptionalText;
  pk?: OptionalText;
  reservistsAssociation?: OptionalText;
  associationMemberNumber?: OptionalText;
};

export type ProfileFieldValidationError = {
  field: keyof ProfileFieldValidationInput;
  message: string;
};

function isProvided(value: OptionalText): value is string | null {
  return value !== undefined;
}

function isFilled(value: OptionalText): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateOptionalProfileFields(input: ProfileFieldValidationInput): ProfileFieldValidationError | null {
  if (isProvided(input.address) && isFilled(input.address)) {
    const result = validateAddress(input.address);
    if (!result.isValid) return { field: "address", message: result.error || "Ungültige Adresse" };
  }

  if (isProvided(input.phone) && isFilled(input.phone)) {
    const result = validatePhone(input.phone);
    if (!result.isValid) return { field: "phone", message: result.error || "Ungültige Telefonnummer" };
  }

  if (isProvided(input.memberSince) && isFilled(input.memberSince) && !validateDateString(input.memberSince)) {
    return { field: "memberSince", message: "Ungültiges Mitglied-seit-Datum" };
  }

  if (isProvided(input.dateOfBirth) && isFilled(input.dateOfBirth)) {
    const result = validateDateOfBirth(input.dateOfBirth);
    if (!result.isValid) return { field: "dateOfBirth", message: result.error || "Ungültiges Geburtsdatum" };
  }

  if (isProvided(input.rank) && isFilled(input.rank)) {
    const result = validateRank(input.rank);
    if (!result.isValid) return { field: "rank", message: result.error || "Ungültiger Dienstgrad" };
  }

  if (isProvided(input.pk) && isFilled(input.pk)) {
    const result = validatePk(input.pk);
    if (!result.isValid) return { field: "pk", message: result.error || "Ungültige PK" };
  }

  if (isProvided(input.reservistsAssociation) && isFilled(input.reservistsAssociation)) {
    const result = validateReservistsAssociation(input.reservistsAssociation);
    if (!result.isValid) {
      return { field: "reservistsAssociation", message: result.error || "Ungültige Reservistenkameradschaft" };
    }
  }

  if (isProvided(input.associationMemberNumber) && isFilled(input.associationMemberNumber)) {
    const result = validateAssociationMemberNumber(input.associationMemberNumber);
    if (!result.isValid) {
      return { field: "associationMemberNumber", message: result.error || "Ungültige Mitgliedsnummer im Verband" };
    }
  }

  return null;
}

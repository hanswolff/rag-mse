import { validatePassword } from "./password-validation";
import { Role } from "@prisma/client";
import {
  validateEmail as validateEmailFormat,
  validatePhone as validatePhoneFormat,
  nameRegex,
  validateDateString,
  profileFormSchema,
  passwordChangeFormSchema,
} from "./validation-schema";

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

export function validateEmail(email: string): boolean {
  return validateEmailFormat(email);
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

export function validateRank(rank: string): { isValid: boolean; error?: string } {
  return validateTextMaxLength(
    rank,
    30,
    "Ungültiger Dienstgrad",
    "Dienstgrad darf maximal 30 Zeichen lang sein"
  );
}

export function validatePk(pk: string): { isValid: boolean; error?: string } {
  return validateTextMaxLength(pk, 20, "Ungültige PK", "PK darf maximal 20 Zeichen lang sein");
}

export function validateReservistsAssociation(value: string): { isValid: boolean; error?: string } {
  return validateTextMaxLength(
    value,
    30,
    "Ungültige Reservistenkameradschaft",
    "Reservistenkameradschaft darf maximal 30 Zeichen lang sein"
  );
}

export function validateAssociationMemberNumber(value: string): { isValid: boolean; error?: string } {
  return validateTextMaxLength(
    value,
    30,
    "Ungültige Mitgliedsnummer im Verband",
    "Mitgliedsnummer im Verband darf maximal 30 Zeichen lang sein"
  );
}

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

export function validateCreateUserRequest(request: CreateUserRequest) {
  const errors: string[] = [];
  const { email, password, name, role = Role.MEMBER } = request;

  if (!email || typeof email !== "string") {
    errors.push("E-Mail ist erforderlich");
  } else if (!validateEmail(email)) {
    errors.push("Ungültiges E-Mail-Format");
  }

  if (!password || typeof password !== "string") {
    errors.push("Passwort ist erforderlich");
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }

  if (!name || typeof name !== "string") {
    errors.push("Name ist erforderlich");
  } else {
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      errors.push(nameValidation.error || "Ungültiger Name");
    }
  }

  if (!Object.values(Role).includes(role)) {
    errors.push("Ungültige Rolle");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUpdateProfileRequest(request: UpdateProfileRequest) {
  // Validate hasPossessionCard separately since it's not in the Zod schema
  if (request.hasPossessionCard !== undefined && typeof request.hasPossessionCard !== "boolean") {
    return {
      isValid: false,
      errors: ["Ungültiger Wert für Waffenbesitzkarte"],
    };
  }

  // Build the data object for Zod validation (only include defined fields)
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

  // If no profile fields to validate, return success
  if (Object.keys(data).length === 0) {
    return { isValid: true, errors: [] };
  }

  // Use partial schema for updates (all fields optional)
  const result = profileFormSchema.partial().safeParse(data);

  if (result.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: result.error.issues.map((issue) => issue.message),
  };
}

export function validateChangePasswordRequest(request: ChangePasswordRequest) {
  const result = passwordChangeFormSchema.safeParse({
    currentPassword: request.currentPassword,
    newPassword: request.newPassword,
    confirmPassword: request.confirmPassword,
  });

  if (result.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: result.error.issues.map((issue) => issue.message),
  };
}

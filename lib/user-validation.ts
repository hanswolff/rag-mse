import { validatePassword } from "./password-validation";
import { Role } from "@prisma/client";
import {
  validateEmail as validateEmailFormat,
  validatePhone as validatePhoneFormat,
  nameRegex,
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
  const errors: string[] = [];
  const { email, name } = request;

  if (email !== undefined) {
    if (typeof email !== "string" || email === "" || !validateEmail(email)) {
      errors.push("Ungültiges E-Mail-Format");
    }
  }

  if (name !== undefined) {
    if (typeof name !== "string") {
      errors.push("Ungültiger Name");
    } else {
      const trimmedName = name.trim();
      if (trimmedName) {
        const nameValidation = validateName(trimmedName);
        if (!nameValidation.isValid) {
          errors.push(nameValidation.error || "Ungültiger Name");
        }
      }
    }
  }

  if (request.address !== undefined) {
    if (typeof request.address !== "string") {
      errors.push("Ungültige Adresse");
    } else {
      const address = request.address.trim();
      if (address && address.length > 200) {
        errors.push("Adresse darf maximal 200 Zeichen lang sein");
      }
    }
  }

  if (request.phone !== undefined) {
    if (typeof request.phone !== "string") {
      errors.push("Ungültige Telefonnummer");
    } else {
      const phone = request.phone.trim();
      if (phone) {
        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.isValid) {
          errors.push(phoneValidation.error || "Ungültige Telefonnummer");
        }
      }
    }
  }

  if (request.memberSince !== undefined) {
    if (typeof request.memberSince !== "string") {
      errors.push("Ungültiges Mitglied-seit-Datum");
    } else if (request.memberSince.trim()) {
      const date = new Date(request.memberSince);
      if (isNaN(date.getTime())) {
        errors.push("Ungültiges Mitglied-seit-Datum");
      }
    }
  }

  if (request.dateOfBirth !== undefined) {
    if (typeof request.dateOfBirth !== "string") {
      errors.push("Ungültiges Geburtsdatum");
    } else if (request.dateOfBirth.trim()) {
      const date = new Date(request.dateOfBirth);
      if (isNaN(date.getTime())) {
        errors.push("Ungültiges Geburtsdatum");
      }
    }
  }

  if (request.rank !== undefined) {
    if (typeof request.rank !== "string") {
      errors.push("Ungültiger Dienstgrad");
    } else if (request.rank.trim()) {
      const trimmedRank = request.rank.trim();
      if (trimmedRank.length > 30) {
        errors.push("Dienstgrad darf maximal 30 Zeichen lang sein");
      }
    }
  }

  if (request.pk !== undefined) {
    if (typeof request.pk !== "string") {
      errors.push("Ungültige PK");
    } else if (request.pk.trim()) {
      const trimmedPk = request.pk.trim();
      if (trimmedPk.length > 20) {
        errors.push("PK darf maximal 20 Zeichen lang sein");
      }
    }
  }

  if (request.hasPossessionCard !== undefined && typeof request.hasPossessionCard !== "boolean") {
    errors.push("Ungültiger Wert für Waffenbesitzkarte");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateChangePasswordRequest(request: ChangePasswordRequest) {
  const errors: string[] = [];
  const { currentPassword, newPassword, confirmPassword } = request;

  if (!currentPassword || typeof currentPassword !== "string") {
    errors.push("Aktuelles Passwort ist erforderlich");
  }

  if (!newPassword || typeof newPassword !== "string") {
    errors.push("Neues Passwort ist erforderlich");
  } else {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    if (currentPassword === newPassword) {
      errors.push("Neues Passwort muss vom aktuellen Passwort abweichen");
    }
  }

  if (!confirmPassword || typeof confirmPassword !== "string") {
    errors.push("Passwortbestätigung ist erforderlich");
  } else if (newPassword !== confirmPassword) {
    errors.push("Neues Passwort und Passwortbestätigung stimmen nicht überein");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  normalizeOptionalField,
  validateAdminNotes,
  validateEmail,
  validateName,
} from "@/lib/user-validation";
import { validateRole } from "@/lib/validation-schema";
import { validateOptionalProfileFields } from "@/lib/profile-fields";
import { logValidationFailure } from "@/lib/logger";
import type { FieldError } from "@/lib/server-error-mapper";

export interface CreateUserPayload {
  email: string;
  name: string;
  role?: Role;
  address?: string;
  phone?: string;
  memberSince?: string;
  dateOfBirth?: string;
  rank?: string;
  pk?: string;
  reservistsAssociation?: string;
  associationMemberNumber?: string;
  hasPossessionCard?: boolean;
  adminNotes?: string;
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  role?: Role;
  memberSince?: string;
  dateOfBirth?: string;
  rank?: string;
  pk?: string;
  reservistsAssociation?: string;
  associationMemberNumber?: string;
  hasPossessionCard?: boolean;
  adminNotes?: string | null;
}

export interface InvitationProfilePayload {
  name: string;
  address?: string;
  phone?: string;
  dateOfBirth?: string;
  rank?: string;
  pk?: string;
  reservistsAssociation?: string;
  associationMemberNumber?: string;
  hasPossessionCard?: boolean;
}

export interface CreateUserData {
  email: string;
  name: string;
  role: Role;
  address: string | null;
  phone: string | null;
  memberSince: Date | null;
  dateOfBirth: Date | null;
  rank: string | null;
  pk: string | null;
  reservistsAssociation: string | null;
  associationMemberNumber: string | null;
  hasPossessionCard: boolean;
  adminNotes: string | null;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  role?: Role;
  memberSince?: Date | null;
  dateOfBirth?: Date | null;
  rank?: string | null;
  pk?: string | null;
  reservistsAssociation?: string | null;
  associationMemberNumber?: string | null;
  hasPossessionCard?: boolean;
  adminNotes?: string | null;
}

export interface InvitationProfileData {
  name: string;
  address: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  rank: string | null;
  pk: string | null;
  reservistsAssociation: string | null;
  associationMemberNumber: string | null;
  hasPossessionCard: boolean;
}

export interface UserPayloadError {
  status: 400 | 403 | 409;
  message: string;
  fieldErrors?: FieldError[];
  logContext?: Record<string, unknown>;
}

export type ParseUserPayloadResult<TData> =
  | { data: TData; error?: undefined }
  | { data?: undefined; error: UserPayloadError };

type ParseUserPayloadOptions =
  | { mode: "create" }
  | { mode: "update"; isEmailTaken?: (normalizedEmail: string) => Promise<boolean> }
  | { mode: "invitation" };

const SITE_ADMIN_ROLE_FORBIDDEN = "Die Rolle Site-Administrator darf nicht vergeben werden";
const EMAIL_TAKEN = "Ein Benutzer mit dieser E-Mail existiert bereits";

function fieldValidationError(
  field: string,
  message: string,
  logContext?: Record<string, unknown>
): UserPayloadError {
  return { status: 400, message, fieldErrors: [{ field, message }], logContext };
}

function profileFieldsError(
  input: Parameters<typeof validateOptionalProfileFields>[0],
  logContext?: Record<string, unknown>
): UserPayloadError | null {
  const error = validateOptionalProfileFields(input);
  if (!error) return null;
  return {
    status: 400,
    message: error.message,
    fieldErrors: [error],
    logContext: { ...logContext, field: error.field },
  };
}

function normalizedString(value: unknown): string | null {
  return normalizeOptionalField(typeof value === "string" ? value : undefined);
}

function parseCreatePayload(body: CreateUserPayload): ParseUserPayloadResult<CreateUserData> {
  const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role || Role.MEMBER;
  const address = normalizeOptionalField(body.address);
  const phone = normalizeOptionalField(body.phone);
  const memberSince = normalizedString(body.memberSince);
  const dateOfBirth = normalizedString(body.dateOfBirth);
  const rank = normalizedString(body.rank);
  const pk = normalizedString(body.pk);
  const reservistsAssociation = normalizedString(body.reservistsAssociation);
  const associationMemberNumber = normalizedString(body.associationMemberNumber);
  const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : false;

  if (role === "SITE_ADMINISTRATOR") {
    return { error: { status: 403, message: SITE_ADMIN_ROLE_FORBIDDEN } };
  }

  if (!normalizedEmail || !validateEmail(normalizedEmail).isValid) {
    const message = "E-Mail ist erforderlich und muss gültig sein";
    return { error: fieldValidationError("email", message, { email: body.email }) };
  }

  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    const message = nameValidation.error || "Ungültiger Name";
    return { error: fieldValidationError("name", message, { email: normalizedEmail }) };
  }

  if (!validateRole(role)) {
    return { error: fieldValidationError("role", "Ungültige Rolle", { email: normalizedEmail, role: body.role }) };
  }

  const profileError = profileFieldsError(
    { address, phone, memberSince, dateOfBirth, rank, pk, reservistsAssociation, associationMemberNumber },
    { email: normalizedEmail }
  );
  if (profileError) {
    return { error: profileError };
  }

  const adminNotes = normalizedString(body.adminNotes);
  if (adminNotes !== null) {
    const adminNotesValidation = validateAdminNotes(adminNotes);
    if (!adminNotesValidation.isValid) {
      const message = adminNotesValidation.error || "Ungültige Administratoren-Notizen";
      return { error: fieldValidationError("adminNotes", message, { email: normalizedEmail }) };
    }
  }

  return {
    data: {
      email: normalizedEmail,
      name,
      role,
      address,
      phone,
      memberSince: memberSince ? new Date(memberSince) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      rank,
      pk,
      reservistsAssociation,
      associationMemberNumber,
      hasPossessionCard,
      adminNotes,
    },
  };
}

async function parseUpdatePayload(
  body: UpdateUserPayload,
  isEmailTaken?: (normalizedEmail: string) => Promise<boolean>
): Promise<ParseUserPayloadResult<UpdateUserData>> {
  const updates: UpdateUserData = {};

  if (body.email !== undefined) {
    const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!normalizedEmail || !validateEmail(normalizedEmail).isValid) {
      return { error: fieldValidationError("email", "E-Mail muss gültig sein") };
    }

    if (isEmailTaken && (await isEmailTaken(normalizedEmail))) {
      return { error: { status: 409, message: EMAIL_TAKEN } };
    }

    updates.email = normalizedEmail;
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return { error: fieldValidationError("name", nameValidation.error || "Ungültiger Name") };
    }
    updates.name = name;
  }

  if (body.address !== undefined) {
    updates.address = normalizeOptionalField(body.address);
  }

  if (body.phone !== undefined) {
    updates.phone = normalizeOptionalField(body.phone);
  }

  if (body.role !== undefined) {
    if (body.role === "SITE_ADMINISTRATOR") {
      return { error: { status: 403, message: SITE_ADMIN_ROLE_FORBIDDEN } };
    }

    if (!validateRole(body.role)) {
      return { error: fieldValidationError("role", "Ungültige Rolle", { role: body.role }) };
    }

    updates.role = body.role;
  }

  const memberSince = typeof body.memberSince === "string" ? body.memberSince : undefined;
  const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth : undefined;
  const rank = typeof body.rank === "string" ? body.rank : undefined;
  const pk = typeof body.pk === "string" ? body.pk : undefined;
  const reservistsAssociation = typeof body.reservistsAssociation === "string" ? body.reservistsAssociation : undefined;
  const associationMemberNumber = typeof body.associationMemberNumber === "string" ? body.associationMemberNumber : undefined;
  const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : undefined;

  const profileError = profileFieldsError({
    address: updates.address,
    phone: updates.phone,
    memberSince,
    dateOfBirth,
    rank,
    pk,
    reservistsAssociation,
    associationMemberNumber,
  });
  if (profileError) {
    return { error: profileError };
  }

  const adminNotes = typeof body.adminNotes === "string" || body.adminNotes === null ? body.adminNotes : undefined;
  if (adminNotes !== undefined) {
    if (adminNotes !== null) {
      const adminNotesValidation = validateAdminNotes(adminNotes);
      if (!adminNotesValidation.isValid) {
        const message = adminNotesValidation.error || "Ungültige Administratoren-Notizen";
        return { error: fieldValidationError("adminNotes", message) };
      }
    }
    updates.adminNotes = adminNotes;
  }

  if (memberSince !== undefined) {
    updates.memberSince = memberSince.trim() ? new Date(memberSince.trim()) : null;
  }
  if (dateOfBirth !== undefined) {
    updates.dateOfBirth = dateOfBirth.trim() ? new Date(dateOfBirth.trim()) : null;
  }
  if (rank !== undefined) {
    updates.rank = rank.trim() || null;
  }
  if (pk !== undefined) {
    updates.pk = pk.trim() || null;
  }
  if (reservistsAssociation !== undefined) {
    updates.reservistsAssociation = reservistsAssociation.trim() || null;
  }
  if (associationMemberNumber !== undefined) {
    updates.associationMemberNumber = associationMemberNumber.trim() || null;
  }
  if (hasPossessionCard !== undefined) {
    updates.hasPossessionCard = hasPossessionCard;
  }

  return { data: updates };
}

function parseInvitationPayload(body: InvitationProfilePayload): ParseUserPayloadResult<InvitationProfileData> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = normalizeOptionalField(body.address);
  const phone = normalizeOptionalField(body.phone);
  const dateOfBirth = normalizedString(body.dateOfBirth);
  const rank = normalizedString(body.rank);
  const pk = normalizedString(body.pk);
  const reservistsAssociation = normalizedString(body.reservistsAssociation);
  const associationMemberNumber = normalizedString(body.associationMemberNumber);
  const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : false;

  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    return { error: fieldValidationError("name", nameValidation.error || "Name ist erforderlich") };
  }

  const profileError = profileFieldsError({
    address,
    phone,
    dateOfBirth,
    rank,
    pk,
    reservistsAssociation,
    associationMemberNumber,
  });
  if (profileError) {
    return { error: profileError };
  }

  return {
    data: {
      name,
      address,
      phone,
      dateOfBirth,
      rank,
      pk,
      reservistsAssociation,
      associationMemberNumber,
      hasPossessionCard,
    },
  };
}

export async function parseUserPayload(
  body: CreateUserPayload,
  options: { mode: "create" }
): Promise<ParseUserPayloadResult<CreateUserData>>;
export async function parseUserPayload(
  body: UpdateUserPayload,
  options: { mode: "update"; isEmailTaken?: (normalizedEmail: string) => Promise<boolean> }
): Promise<ParseUserPayloadResult<UpdateUserData>>;
export async function parseUserPayload(
  body: InvitationProfilePayload,
  options: { mode: "invitation" }
): Promise<ParseUserPayloadResult<InvitationProfileData>>;
export async function parseUserPayload(
  body: CreateUserPayload | UpdateUserPayload | InvitationProfilePayload,
  options: ParseUserPayloadOptions
): Promise<ParseUserPayloadResult<CreateUserData | UpdateUserData | InvitationProfileData>> {
  switch (options.mode) {
    case "create":
      return parseCreatePayload(body as CreateUserPayload);
    case "update":
      return parseUpdatePayload(body as UpdateUserPayload, options.isEmailTaken);
    case "invitation":
      return parseInvitationPayload(body as InvitationProfilePayload);
  }
}

export function userPayloadErrorResponse(
  error: UserPayloadError,
  log: { route: string; method: string; context?: Record<string, unknown> }
): NextResponse {
  if (error.status === 400) {
    logValidationFailure(log.route, log.method, error.message, {
      ...log.context,
      ...error.logContext,
    });
  }

  const body: { error: string; fieldErrors?: FieldError[] } = { error: error.message };
  if (error.fieldErrors) {
    body.fieldErrors = error.fieldErrors;
  }
  return NextResponse.json(body, { status: error.status });
}

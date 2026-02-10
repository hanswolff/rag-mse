import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import {
  validateEmail,
  normalizeOptionalField,
  validateAddress,
  validatePhone,
  validateName,
  validateRank,
  validatePk,
  validateReservistsAssociation,
  validateAssociationMemberNumber,
} from "@/lib/user-validation";
import { validateRole, validateDateString } from "@/lib/validation-schema";
import { requireAdmin } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { parseJsonBody, BadRequestError, withApiErrorHandling, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { logValidationFailure, logInfo } from "@/lib/logger";
import { formatDateInputValue } from "@/lib/date-picker-utils";
import {
  buildInviteUrl,
  generateInvitationToken,
  getInvitationExpiryDate,
  hashInvitationToken,
  sendInvitationEmail,
} from "@/lib/invitations";
import { generateRandomPassword } from "@/lib/crypto-utils";

const BCRYPT_SALT_ROUNDS = 10;
const INVITED_AT_EPOCH = new Date("1970-01-01T00:00:00.000Z");

function serializeUserDateFields<T extends { memberSince: Date | null; dateOfBirth: Date | null }>(user: T) {
  return {
    ...user,
    memberSince: formatDateInputValue(user.memberSince),
    dateOfBirth: formatDateInputValue(user.dateOfBirth),
  };
}

interface CreateUserRequest {
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
}

const createUserSchema = {
  email: { type: 'string' as const },
  name: { type: 'string' as const },
  role: { type: 'string' as const, optional: true },
  address: { type: 'string' as const, optional: true },
  phone: { type: 'string' as const, optional: true },
  memberSince: { type: 'string' as const, optional: true },
  dateOfBirth: { type: 'string' as const, optional: true },
  rank: { type: 'string' as const, optional: true },
  pk: { type: 'string' as const, optional: true },
  reservistsAssociation: { type: 'string' as const, optional: true },
  associationMemberNumber: { type: 'string' as const, optional: true },
  hasPossessionCard: { type: 'boolean' as const, optional: true },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin();

  const body = await parseJsonBody<CreateUserRequest>(request);

  const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, createUserSchema, { route: '/api/admin/users', method: 'POST' });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role || Role.MEMBER;
  const address = normalizeOptionalField(body.address);
  const phone = normalizeOptionalField(body.phone);
  const memberSince = typeof body.memberSince === "string" ? body.memberSince : undefined;
  const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth : undefined;
  const rank = typeof body.rank === "string" ? body.rank : undefined;
  const pk = typeof body.pk === "string" ? body.pk : undefined;
  const reservistsAssociation = typeof body.reservistsAssociation === "string" ? body.reservistsAssociation : undefined;
  const associationMemberNumber = typeof body.associationMemberNumber === "string" ? body.associationMemberNumber : undefined;
  const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : false;

  if (!normalizedEmail || !validateEmail(normalizedEmail)) {
    logValidationFailure('/api/admin/users', 'POST', 'E-Mail ist erforderlich und muss gültig sein', {
      email: body.email,
    });
    return NextResponse.json(
      { error: "E-Mail ist erforderlich und muss gültig sein" },
      { status: 400 }
    );
  }

  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    logValidationFailure('/api/admin/users', 'POST', nameValidation.error || 'Ungültiger Name', {
      email: normalizedEmail,
    });
    return NextResponse.json(
      { error: nameValidation.error || "Ungültiger Name" },
      { status: 400 }
    );
  }

  if (!validateRole(role)) {
    logValidationFailure('/api/admin/users', 'POST', 'Ungültige Rolle', {
      email: normalizedEmail,
      role: body.role,
    });
    return NextResponse.json(
      { error: "Ungültige Rolle" },
      { status: 400 }
    );
  }

  if (address !== null) {
    const addressValidation = validateAddress(address);
    if (!addressValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', addressValidation.error || 'Invalid address', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: addressValidation.error }, { status: 400 });
    }
  }

  if (phone !== null) {
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', phoneValidation.error || 'Invalid phone', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
    }
  }

  // Validate new profile fields
  if (memberSince !== undefined) {
    if (typeof memberSince !== "string" || !memberSince.trim()) {
      logValidationFailure('/api/admin/users', 'POST', 'Ungültiges Mitglied-seit-Datum', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: "Ungültiges Mitglied-seit-Datum" }, { status: 400 });
    }
    if (!validateDateString(memberSince)) {
      logValidationFailure('/api/admin/users', 'POST', 'Ungültiges Mitglied-seit-Datum', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: "Ungültiges Mitglied-seit-Datum" }, { status: 400 });
    }
  }

  if (dateOfBirth !== undefined) {
    if (typeof dateOfBirth !== "string" || !dateOfBirth.trim()) {
      // Empty is fine
    } else if (!validateDateString(dateOfBirth)) {
      logValidationFailure('/api/admin/users', 'POST', 'Ungültiges Geburtsdatum', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: "Ungültiges Geburtsdatum" }, { status: 400 });
    }
  }

  if (rank !== undefined) {
    const rankValidation = validateRank(rank);
    if (!rankValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', rankValidation.error || 'Ungültiger Dienstgrad', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: rankValidation.error }, { status: 400 });
    }
  }

  if (pk !== undefined) {
    const pkValidation = validatePk(pk);
    if (!pkValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', pkValidation.error || 'Ungültige PK', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: pkValidation.error }, { status: 400 });
    }
  }

  if (reservistsAssociation !== undefined) {
    const reservistsAssociationValidation = validateReservistsAssociation(reservistsAssociation);
    if (!reservistsAssociationValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', reservistsAssociationValidation.error || 'Ungültige Reservistenkameradschaft', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: reservistsAssociationValidation.error }, { status: 400 });
    }
  }

  if (associationMemberNumber !== undefined) {
    const associationMemberNumberValidation = validateAssociationMemberNumber(associationMemberNumber);
    if (!associationMemberNumberValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', associationMemberNumberValidation.error || 'Ungültige Mitgliedsnummer im Verband', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: associationMemberNumberValidation.error }, { status: 400 });
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "Ein Benutzer mit dieser E-Mail existiert bereits" },
      { status: 409 }
    );
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new BadRequestError("APP_URL ist nicht konfiguriert");
  }

  const randomPassword = generateRandomPassword();
  const hashedPassword = await hash(randomPassword, BCRYPT_SALT_ROUNDS);
  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = getInvitationExpiryDate();

  const newUser = await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        role,
        address,
        phone,
        memberSince: memberSince ? new Date(memberSince) : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        rank: rank || null,
        pk: pk || null,
        reservistsAssociation: reservistsAssociation || null,
        associationMemberNumber: associationMemberNumber || null,
        hasPossessionCard: hasPossessionCard || false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        address: true,
        phone: true,
        memberSince: true,
        dateOfBirth: true,
        rank: true,
        pk: true,
        reservistsAssociation: true,
        associationMemberNumber: true,
        hasPossessionCard: true,
        createdAt: true,
      },
    });

    await tx.invitation.create({
      data: {
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        invitedById: admin.id,
        role,
      },
    });

    await tx.invitation.updateMany({
      where: {
        email: normalizedEmail,
        usedAt: null,
        NOT: { tokenHash },
      },
      data: {
        usedAt: INVITED_AT_EPOCH,
      },
    });

    return user;
  });

  const inviteUrl = buildInviteUrl(appUrl, token);

  const emailResult = await sendInvitationEmail({
    email: normalizedEmail,
    inviteUrl,
    logContext: {
      route: "/api/admin/users",
      method: "POST",
      userId: newUser.id,
      ...(admin.email && { userEmail: admin.email }),
    },
  });

  if (!emailResult.success) {
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  return NextResponse.json(serializeUserDateFields(newUser), { status: 201 });
}, { route: "/api/admin/users", method: "POST" });

export const GET = withApiErrorHandling(async () => {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      address: true,
      phone: true,
      memberSince: true,
      dateOfBirth: true,
      rank: true,
      pk: true,
      reservistsAssociation: true,
      associationMemberNumber: true,
      hasPossessionCard: true,
      createdAt: true,
      lastLoginAt: true,
      passwordUpdatedAt: true,
    },
  });

  const sortedUsers = users.sort((a, b) => {
    if (a.role === b.role) {
      const nameA = a.name ?? "";
      const nameB = b.name ?? "";

      return nameA.localeCompare(nameB, "de");
    }
    return a.role === Role.MEMBER ? -1 : 1;
  });

  logInfo('admin_users_list', 'Admin accessed user list', {
    adminId: admin.id,
    adminEmail: admin.email,
    userCount: sortedUsers.length,
  });

  return NextResponse.json(sortedUsers.map((user) => serializeUserDateFields(user)));
}, { route: "/api/admin/users", method: "GET" });

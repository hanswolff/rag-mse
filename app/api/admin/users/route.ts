import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import {
  validateEmail,
  normalizeOptionalField,
  validateName,
  validateAdminNotes,
} from "@/lib/user-validation";
import { validateRole } from "@/lib/validation-schema";
import { requireAdmin } from "@/lib/auth-utils";
import { Role, Prisma } from "@prisma/client";
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
import { validateOptionalProfileFields } from "@/lib/profile-fields";

const BCRYPT_SALT_ROUNDS = 10;
function serializeUserDateFields<T extends { memberSince: Date | null; dateOfBirth: Date | null }>(user: T) {
  return {
    ...user,
    memberSince: formatDateInputValue(user.memberSince),
    dateOfBirth: formatDateInputValue(user.dateOfBirth),
  };
}

async function rollbackProvisionedUser(userId: string, email: string, tokenHash: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.invitation.deleteMany({
        where: {
          email,
          tokenHash,
        },
      });

      await tx.user.deleteMany({
        where: { id: userId },
      });
    });
  } catch (rollbackError) {
    logInfo("admin_user_create_rollback_failed", "Failed to rollback user provisioning after invitation email error", {
      userId,
      email,
      error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
    });
  }
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
  adminNotes?: string;
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
  adminNotes: { type: 'string' as const, optional: true },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin("write");

  const body = await parseJsonBody<CreateUserRequest>(request);

  const bodyValidation = validateRequestBody(body, createUserSchema, { route: '/api/admin/users', method: 'POST' });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role || Role.MEMBER;
  const address = normalizeOptionalField(body.address);
  const phone = normalizeOptionalField(body.phone);
  const memberSince = normalizeOptionalField(typeof body.memberSince === "string" ? body.memberSince : undefined);
  const dateOfBirth = normalizeOptionalField(typeof body.dateOfBirth === "string" ? body.dateOfBirth : undefined);
  const rank = normalizeOptionalField(typeof body.rank === "string" ? body.rank : undefined);
  const pk = normalizeOptionalField(typeof body.pk === "string" ? body.pk : undefined);
  const reservistsAssociation = normalizeOptionalField(typeof body.reservistsAssociation === "string" ? body.reservistsAssociation : undefined);
  const associationMemberNumber = normalizeOptionalField(typeof body.associationMemberNumber === "string" ? body.associationMemberNumber : undefined);
  const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : false;

  if (role === "SITE_ADMINISTRATOR") {
    return NextResponse.json(
      { error: "Die Rolle SiteAdministrator darf nicht vergeben werden" },
      { status: 403 }
    );
  }

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

  const optionalProfileFieldError = validateOptionalProfileFields({
    address,
    phone,
    memberSince,
    dateOfBirth,
    rank,
    pk,
    reservistsAssociation,
    associationMemberNumber,
  });
  if (optionalProfileFieldError) {
    logValidationFailure('/api/admin/users', 'POST', optionalProfileFieldError.message, {
      email: normalizedEmail,
      field: optionalProfileFieldError.field,
    });
    return NextResponse.json({ error: optionalProfileFieldError.message }, { status: 400 });
  }

  const adminNotes = normalizeOptionalField(typeof body.adminNotes === "string" ? body.adminNotes : undefined);
  if (adminNotes !== null) {
    const adminNotesValidation = validateAdminNotes(adminNotes);
    if (!adminNotesValidation.isValid) {
      logValidationFailure('/api/admin/users', 'POST', adminNotesValidation.error || 'Ungültige Administratoren-Notizen', {
        email: normalizedEmail,
      });
      return NextResponse.json({ error: adminNotesValidation.error }, { status: 400 });
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

  const newUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
        rank,
        pk,
        reservistsAssociation,
        associationMemberNumber,
        hasPossessionCard: hasPossessionCard || false,
        adminNotes,
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
        adminNotes: true,
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
        usedAt: new Date(),
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
    await rollbackProvisionedUser(newUser.id, normalizedEmail, tokenHash);
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  return NextResponse.json(serializeUserDateFields(newUser), { status: 201 });
}, { route: "/api/admin/users", method: "POST" });

export const GET = withApiErrorHandling(async () => {
  const admin = await requireAdmin("read");

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
      adminNotes: true,
      createdAt: true,
      lastLoginAt: true,
      passwordUpdatedAt: true,
    },
  });

  const sortedUsers = users.sort((a, b) => {
    const roleOrder: Record<Role, number> = {
      SITE_ADMINISTRATOR: 0,
      ADMIN: 1,
      AUDITOR: 2,
      MEMBER: 3,
    };

    if (a.role === b.role) {
      const nameA = a.name ?? "";
      const nameB = b.name ?? "";

      return nameA.localeCompare(nameB, "de");
    }
    return roleOrder[a.role] - roleOrder[b.role];
  });

  logInfo('admin_users_list', 'Admin accessed user list', {
    adminId: admin.id,
    userCount: sortedUsers.length,
  });

  return NextResponse.json(sortedUsers.map((user) => serializeUserDateFields(user)));
}, { route: "/api/admin/users", method: "GET" });

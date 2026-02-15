import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, withApiErrorHandling, validateCsrfHeaders, validateRequestBody } from "@/lib/api-utils";
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
  validateDateOfBirth,
} from "@/lib/user-validation";
import { validateRole, validateDateString } from "@/lib/validation-schema";
import { Role } from "@prisma/client";
import { logResourceNotFound, logInfo, logValidationFailure } from "@/lib/logger";
import { formatDateInputValue } from "@/lib/date-picker-utils";

interface UpdateUserRequest {
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
}

interface UpdateUserData {
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
}

const updateUserSchema = {
  email: { type: 'string' as const, optional: true },
  name: { type: 'string' as const, optional: true },
  address: { type: 'string' as const, optional: true },
  phone: { type: 'string' as const, optional: true },
  role: { type: 'string' as const, optional: true },
  memberSince: { type: 'string' as const, optional: true },
  dateOfBirth: { type: 'string' as const, optional: true },
  rank: { type: 'string' as const, optional: true },
  pk: { type: 'string' as const, optional: true },
  reservistsAssociation: { type: 'string' as const, optional: true },
  associationMemberNumber: { type: 'string' as const, optional: true },
  hasPossessionCard: { type: 'boolean' as const, optional: true },
} as const;

export const PATCH = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  validateCsrfHeaders(request);

  await requireAdmin();

  const { id } = await context.params;
  const body = await parseJsonBody<UpdateUserRequest>(request);
  const bodyValidation = validateRequestBody(
    body as unknown as Record<string, unknown>,
    updateUserSchema,
    { route: '/api/admin/users/[id]', method: 'PATCH' }
  );

  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    logResourceNotFound('user', id, '/api/admin/users/[id]', 'PATCH');
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  const updates: UpdateUserData = {};

  if (body.email !== undefined) {
    const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!normalizedEmail || !validateEmail(normalizedEmail)) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', 'E-Mail muss gültig sein', { userId: id });
      return NextResponse.json(
        { error: "E-Mail muss gültig sein" },
        { status: 400 }
      );
    }

    if (normalizedEmail !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Ein Benutzer mit dieser E-Mail existiert bereits" },
          { status: 409 }
        );
      }
    }

    updates.email = normalizedEmail;
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', nameValidation.error || 'Ungültiger Name', { userId: id });
      return NextResponse.json(
        { error: nameValidation.error || "Ungültiger Name" },
        { status: 400 }
      );
    }
    updates.name = name;
  }

  if (body.address !== undefined) {
    const address = normalizeOptionalField(body.address);
    if (address !== null) {
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        logValidationFailure('/api/admin/users/[id]', 'PATCH', addressValidation.error || 'Invalid address', { userId: id });
        return NextResponse.json({ error: addressValidation.error }, { status: 400 });
      }
    }
    updates.address = address;
  }

  if (body.phone !== undefined) {
    const phone = normalizeOptionalField(body.phone);
    if (phone !== null) {
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.isValid) {
        logValidationFailure('/api/admin/users/[id]', 'PATCH', phoneValidation.error || 'Invalid phone', { userId: id });
        return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
      }
    }
    updates.phone = phone;
  }

  if (body.role !== undefined) {
    if (!validateRole(body.role)) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', 'Ungültige Rolle', {
        userId: id,
        role: body.role,
      });
      return NextResponse.json(
        { error: "Ungültige Rolle" },
        { status: 400 }
      );
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

  // Validate new profile fields
  if (memberSince !== undefined) {
    if (typeof memberSince !== "string" || !memberSince.trim()) {
      // Empty is fine
    } else if (!validateDateString(memberSince)) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', 'Ungültiges Mitglied-seit-Datum', { userId: id });
      return NextResponse.json({ error: "Ungültiges Mitglied-seit-Datum" }, { status: 400 });
    }
  }

  if (dateOfBirth !== undefined) {
    const dateOfBirthValidation = validateDateOfBirth(dateOfBirth);
    if (!dateOfBirthValidation.isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', dateOfBirthValidation.error || 'Ungültiges Geburtsdatum', { userId: id });
      return NextResponse.json({ error: dateOfBirthValidation.error || "Ungültiges Geburtsdatum" }, { status: 400 });
    }
  }

  if (rank !== undefined) {
    const rankValidation = validateRank(rank);
    if (!rankValidation.isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', rankValidation.error || 'Ungültiger Dienstgrad', { userId: id });
      return NextResponse.json({ error: rankValidation.error }, { status: 400 });
    }
  }

  if (pk !== undefined) {
    const pkValidation = validatePk(pk);
    if (!pkValidation.isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', pkValidation.error || 'Ungültige PK', { userId: id });
      return NextResponse.json({ error: pkValidation.error }, { status: 400 });
    }
  }

  if (reservistsAssociation !== undefined) {
    const reservistsAssociationValidation = validateReservistsAssociation(reservistsAssociation);
    if (!reservistsAssociationValidation.isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', reservistsAssociationValidation.error || 'Ungültige Reservistenkameradschaft', { userId: id });
      return NextResponse.json({ error: reservistsAssociationValidation.error }, { status: 400 });
    }
  }

  if (associationMemberNumber !== undefined) {
    const associationMemberNumberValidation = validateAssociationMemberNumber(associationMemberNumber);
    if (!associationMemberNumberValidation.isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', associationMemberNumberValidation.error || 'Ungültige Mitgliedsnummer im Verband', { userId: id });
      return NextResponse.json({ error: associationMemberNumberValidation.error }, { status: 400 });
    }
  }

  if (memberSince !== undefined) {
    updates.memberSince = memberSince.trim() ? new Date(memberSince) : null;
  }
  if (dateOfBirth !== undefined) {
    updates.dateOfBirth = dateOfBirth.trim() ? new Date(dateOfBirth) : null;
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

  const updateSelect = {
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
  } as const;

  const isAdminDemotion = user.role === "ADMIN" && updates.role !== undefined && updates.role !== "ADMIN";

  let updatedUser: {
    id: string;
    email: string;
    name: string | null;
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
    createdAt: Date;
  };
  try {
    updatedUser = isAdminDemotion
      ? await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
          const target = await tx.user.findUnique({
            where: { id },
            select: { role: true },
          });

          if (!target) {
            throw new Error("USER_NOT_FOUND_IN_TX");
          }

          if (target.role === "ADMIN") {
            const adminCount = await tx.user.count({
              where: { role: "ADMIN" },
            });

            if (adminCount <= 1) {
              throw new Error("LAST_ADMIN_DEMOTION_BLOCKED");
            }
          }

          return tx.user.update({
            where: { id },
            data: updates,
            select: updateSelect,
          });
        })
      : await prisma.user.update({
          where: { id },
          data: updates,
          select: updateSelect,
        });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN_DEMOTION_BLOCKED") {
      return NextResponse.json(
        { error: "Der letzte Administrator darf nicht herabgestuft werden" },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND_IN_TX") {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }
    throw error;
  }

  const changedFields: string[] = Object.keys(updates);
  logInfo('user_updated', 'User updated by admin', {
    userId: updatedUser.id,
    email: updatedUser.email,
    changedFields,
    updatedBy: 'admin',
  });

  return NextResponse.json({
    ...updatedUser,
    memberSince: formatDateInputValue(updatedUser.memberSince),
    dateOfBirth: formatDateInputValue(updatedUser.dateOfBirth),
  });
}, { route: "/api/admin/users/[id]", method: "PATCH" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  validateCsrfHeaders(request);

  await requireAdmin();

  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!user) {
    logResourceNotFound('user', id, '/api/admin/users/[id]', 'DELETE');
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  let deletedCount = 0;
  try {
    deletedCount = await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { role: true },
      });

      if (!target) {
        return 0;
      }

      if (target.role === "ADMIN") {
        const adminCount = await tx.user.count({
          where: { role: "ADMIN" },
        });

        if (adminCount <= 1) {
          throw new Error("LAST_ADMIN_DELETE_BLOCKED");
        }
      }

      await tx.vote.deleteMany({
        where: { userId: id },
      });

      const result = await tx.user.deleteMany({
        where: { id },
      });

      return result.count;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN_DELETE_BLOCKED") {
      return NextResponse.json(
        { error: "Der letzte Administrator darf nicht gelöscht werden" },
        { status: 403 }
      );
    }
    throw error;
  }

  if (deletedCount === 0) {
    logResourceNotFound('user', id, '/api/admin/users/[id]', 'DELETE');
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  logInfo('user_deleted', 'User deleted', {
    userId: user.id,
    deletedBy: 'admin',
  });

  return NextResponse.json({ message: "Benutzer wurde erfolgreich gelöscht" });
}, { route: "/api/admin/users/[id]", method: "DELETE" });

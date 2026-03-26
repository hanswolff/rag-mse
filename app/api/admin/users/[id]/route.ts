import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, withApiErrorHandling, validateCsrfHeaders, validateRequestBody } from "@/lib/api-utils";
import {
  validateEmail,
  normalizeOptionalField,
  validateName,
  validateAdminNotes,
} from "@/lib/user-validation";
import { validateRole } from "@/lib/validation-schema";
import { Role } from "@prisma/client";
import { logResourceNotFound, logInfo, logValidationFailure } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";
import { UserNotFoundInTransactionError, LastAdminDemotionBlockedError, LastAdminDeleteBlockedError } from "@/lib/errors";
import { formatDateInputValue } from "@/lib/date-picker-utils";
import { sendRoleChangeEmail } from "@/lib/role-change-email";
import { validateOptionalProfileFields } from "@/lib/profile-fields";

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
  adminNotes?: string | null;
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
  adminNotes?: string | null;
}

const updateUserSchema = {
  email: { type: 'string' as const, optional: true },
  name: { type: 'string' as const, optional: true },
  address: { type: 'string' as const, optional: true, nullable: true },
  phone: { type: 'string' as const, optional: true, nullable: true },
  role: { type: 'string' as const, optional: true },
  memberSince: { type: 'string' as const, optional: true },
  dateOfBirth: { type: 'string' as const, optional: true },
  rank: { type: 'string' as const, optional: true },
  pk: { type: 'string' as const, optional: true },
  reservistsAssociation: { type: 'string' as const, optional: true },
  associationMemberNumber: { type: 'string' as const, optional: true },
  hasPossessionCard: { type: 'boolean' as const, optional: true },
  adminNotes: { type: 'string' as const, optional: true, nullable: true },
} as const;

export const PATCH = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  validateCsrfHeaders(request);

  const actingUser = await requireAdmin("write");

  const { id } = await context.params;
  const body = await parseJsonBody<UpdateUserRequest>(request);
  const bodyValidation = validateRequestBody(
    body,
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

  if (user.role === "SITE_ADMINISTRATOR" && actingUser.role !== "SITE_ADMINISTRATOR") {
    return NextResponse.json(
      { error: "Der SiteAdministrator darf nur vom SiteAdministrator geändert werden" },
      { status: 403 }
    );
  }

  const updates: UpdateUserData = {};

  if (body.email !== undefined) {
    const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!normalizedEmail || !validateEmail(normalizedEmail).isValid) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', 'E-Mail muss gültig sein', { userId: id });
      return NextResponse.json(
        { error: "E-Mail muss gültig sein", fieldErrors: [{ field: "email", message: "E-Mail muss gültig sein" }] },
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
        { error: nameValidation.error || "Ungültiger Name", fieldErrors: [{ field: "name", message: nameValidation.error || "Ungültiger Name" }] },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Die Rolle SiteAdministrator darf nicht vergeben werden" },
        { status: 403 }
      );
    }

    if (!validateRole(body.role)) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', 'Ungültige Rolle', {
        userId: id,
        role: body.role,
      });
      return NextResponse.json(
        { error: "Ungültige Rolle", fieldErrors: [{ field: "role", message: "Ungültige Rolle" }] },
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

  const optionalProfileFieldError = validateOptionalProfileFields({
    address: updates.address,
    phone: updates.phone,
    memberSince,
    dateOfBirth,
    rank,
    pk,
    reservistsAssociation,
    associationMemberNumber,
  });
  if (optionalProfileFieldError) {
    logValidationFailure('/api/admin/users/[id]', 'PATCH', optionalProfileFieldError.message, {
      userId: id,
      field: optionalProfileFieldError.field,
    });
    return NextResponse.json({ error: optionalProfileFieldError.message, fieldErrors: [optionalProfileFieldError] }, { status: 400 });
  }

  const adminNotes = typeof body.adminNotes === "string" || body.adminNotes === null ? body.adminNotes : undefined;
  if (adminNotes !== undefined) {
    if (adminNotes !== null) {
      const adminNotesValidation = validateAdminNotes(adminNotes);
      if (!adminNotesValidation.isValid) {
        logValidationFailure('/api/admin/users/[id]', 'PATCH', adminNotesValidation.error || 'Ungültige Administratoren-Notizen', { userId: id });
        return NextResponse.json({ error: adminNotesValidation.error, fieldErrors: [{ field: "adminNotes", message: adminNotesValidation.error || "Ungültige Administratoren-Notizen" }] }, { status: 400 });
      }
    }
    updates.adminNotes = adminNotes;
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
    adminNotes: true,
    createdAt: true,
  } as const;

  const isAdminDemotion = user.role === "ADMIN" && updates.role !== undefined && updates.role !== "ADMIN";
  const isSiteAdminRoleChange = user.role === "SITE_ADMINISTRATOR" && updates.role !== undefined && updates.role !== "SITE_ADMINISTRATOR";

  if (isSiteAdminRoleChange) {
    return NextResponse.json(
      { error: "Der SiteAdministrator darf nicht herabgestuft werden" },
      { status: 403 }
    );
  }

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
    adminNotes: string | null;
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
            throw new UserNotFoundInTransactionError();
          }

          if (target.role === "ADMIN") {
            const adminCount = await tx.user.count({
              where: { role: "ADMIN" },
            });

            if (adminCount <= 1) {
              throw new LastAdminDemotionBlockedError();
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
    if (error instanceof LastAdminDemotionBlockedError) {
      return NextResponse.json(
        { error: "Der letzte Administrator darf nicht herabgestuft werden" },
        { status: 403 }
      );
    }
    if (error instanceof UserNotFoundInTransactionError) {
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
    changedFields,
    updatedBy: 'admin',
  });

  logAdminAction("user_update", actingUser, {
    targetUserId: updatedUser.id,
    changedFields,
    roleChanged: updates.role ? { from: user.role, to: updates.role } : undefined,
  });

  // Send role change email if role was changed
  if (updates.role && user.role !== updates.role) {
    await sendRoleChangeEmail({
      email: updatedUser.email,
      userName: updatedUser.name || updatedUser.email,
      oldRole: user.role,
      newRole: updates.role,
      changedByName: actingUser.name || actingUser.email || "Ein Administrator",
      logContext: {
        route: "/api/admin/users/[id]",
        method: "PATCH",
        userId: updatedUser.id,
        userEmail: actingUser.email || undefined,
      },
    });
  }

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

  const actingAdmin = await requireAdmin("write");

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

  if (user.role === "SITE_ADMINISTRATOR") {
    return NextResponse.json(
      { error: "Der SiteAdministrator darf nicht gelöscht werden" },
      { status: 403 }
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
          throw new LastAdminDeleteBlockedError();
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
    if (error instanceof LastAdminDeleteBlockedError) {
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

  logAdminAction("user_delete", actingAdmin, {
    targetUserId: user.id,
    targetRole: user.role,
  });

  return NextResponse.json({ message: "Benutzer wurde erfolgreich gelöscht" });
}, { route: "/api/admin/users/[id]", method: "DELETE" });

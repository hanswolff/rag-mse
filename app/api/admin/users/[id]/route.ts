import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, withApiErrorHandling, validateCsrfHeaders, validateRequestBody } from "@/lib/api-utils";
import { validateEmail, normalizeOptionalField, validateAddress, validatePhone, validateName } from "@/lib/user-validation";
import { validateRole, validateDateString } from "@/lib/validation-schema";
import { Role } from "@prisma/client";
import { logResourceNotFound, logInfo, logValidationFailure } from "@/lib/logger";

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
    if (typeof dateOfBirth !== "string" || !dateOfBirth.trim()) {
      // Empty is fine
    } else if (!validateDateString(dateOfBirth)) {
      logValidationFailure('/api/admin/users/[id]', 'PATCH', 'Ungültiges Geburtsdatum', { userId: id });
      return NextResponse.json({ error: "Ungültiges Geburtsdatum" }, { status: 400 });
    }
  }

  if (rank !== undefined && rank.trim() && rank.trim().length > 30) {
    logValidationFailure('/api/admin/users/[id]', 'PATCH', 'Dienstgrad darf maximal 30 Zeichen lang sein', { userId: id });
    return NextResponse.json({ error: "Dienstgrad darf maximal 30 Zeichen lang sein" }, { status: 400 });
  }

  if (pk !== undefined && pk.trim() && pk.trim().length > 20) {
    logValidationFailure('/api/admin/users/[id]', 'PATCH', 'PK darf maximal 20 Zeichen lang sein', { userId: id });
    return NextResponse.json({ error: "PK darf maximal 20 Zeichen lang sein" }, { status: 400 });
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

  return NextResponse.json(updatedUser);
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

  if (user.role === "ADMIN") {
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
  } else {
    await prisma.user.delete({
      where: { id },
    });
  }

  logInfo('user_deleted', 'User deleted', {
    userId: user.id,
    deletedBy: 'admin',
  });

  return NextResponse.json({ message: "Benutzer wurde erfolgreich gelöscht" });
}, { route: "/api/admin/users/[id]", method: "DELETE" });

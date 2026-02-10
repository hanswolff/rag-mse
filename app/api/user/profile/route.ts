import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { validateUpdateProfileRequest, type UpdateProfileRequest } from "@/lib/user-validation";
import { Prisma } from "@prisma/client";
import { BadRequestError, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logValidationFailure, logResourceNotFound } from "@/lib/logger";
import { formatDateInputValue } from "@/lib/date-picker-utils";

const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  address: true,
  phone: true,
  role: true,
  lastLoginAt: true,
  passwordUpdatedAt: true,
  memberSince: true,
  dateOfBirth: true,
  rank: true,
  pk: true,
  reservistsAssociation: true,
  associationMemberNumber: true,
  hasPossessionCard: true,
} as const;

function handleApiError(error: unknown, method: "GET" | "PUT") {
  if (error instanceof Error && error.name === "UnauthorizedError") {
    return NextResponse.json(
      { error: "Nicht autorisiert" },
      { status: 401 }
    );
  }

  logApiError(error, {
    route: "/api/user/profile",
    method,
    status: 500,
  });
  return NextResponse.json(
    { error: "Ein Fehler ist aufgetreten" },
    { status: 500 }
  );
}

const updateProfileSchema = {
  email: { type: 'string' as const, optional: true },
  name: { type: 'string' as const, optional: true },
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

export async function PUT(request: NextRequest) {
  try {
    validateCsrfHeaders(request);

    const user = await requireAuth();
    const body = await parseJsonBody<UpdateProfileRequest>(request);

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, updateProfileSchema, { route: '/api/user/profile', method: 'PUT' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const validation = validateUpdateProfileRequest(body);
    if (!validation.isValid) {
      logValidationFailure('/api/user/profile', 'PUT', validation.errors, { userId: user.id });
      return NextResponse.json(
        { error: validation.errors.join(". ") },
        { status: 400 }
      );
    }

    const {
      name,
      address,
      phone,
      email,
      memberSince,
      dateOfBirth,
      rank,
      pk,
      reservistsAssociation,
      associationMemberNumber,
      hasPossessionCard,
    } = body;
    const normalizedEmail =
      email !== undefined ? String(email).trim().toLowerCase() : undefined;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = String(name).trim() || null;
    if (address !== undefined) updateData.address = String(address).trim() || null;
    if (phone !== undefined) updateData.phone = String(phone).trim() || null;
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
    if (memberSince !== undefined) updateData.memberSince = memberSince.trim() ? new Date(memberSince) : null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth.trim() ? new Date(dateOfBirth) : null;
    if (rank !== undefined) updateData.rank = String(rank).trim() || null;
    if (pk !== undefined) updateData.pk = String(pk).trim() || null;
    if (reservistsAssociation !== undefined) updateData.reservistsAssociation = String(reservistsAssociation).trim() || null;
    if (associationMemberNumber !== undefined) updateData.associationMemberNumber = String(associationMemberNumber).trim() || null;
    if (hasPossessionCard !== undefined) updateData.hasPossessionCard = hasPossessionCard;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: USER_SELECT_FIELDS,
    });

    const changedFields: string[] = [];
    if (name !== undefined) changedFields.push('name');
    if (address !== undefined) changedFields.push('address');
    if (phone !== undefined) changedFields.push('phone');
    if (email !== undefined) changedFields.push('email');
    if (memberSince !== undefined) changedFields.push('memberSince');
    if (dateOfBirth !== undefined) changedFields.push('dateOfBirth');
    if (rank !== undefined) changedFields.push('rank');
    if (pk !== undefined) changedFields.push('pk');
    if (reservistsAssociation !== undefined) changedFields.push('reservistsAssociation');
    if (associationMemberNumber !== undefined) changedFields.push('associationMemberNumber');
    if (hasPossessionCard !== undefined) changedFields.push('hasPossessionCard');

    logInfo('profile_updated', 'User profile updated', {
      userId: user.id,
      userEmail: user.email,
      changedFields,
    });

    return NextResponse.json({
      ...updatedUser,
      memberSince: formatDateInputValue(updatedUser.memberSince),
      dateOfBirth: formatDateInputValue(updatedUser.dateOfBirth),
    });
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "E-Mail-Adresse wird bereits verwendet" },
        { status: 409 }
      );
    }

    return handleApiError(error, "PUT");
  }
}

export async function GET() {
  try {
    const user = await requireAuth();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: USER_SELECT_FIELDS,
    });

    if (!userData) {
      logResourceNotFound('user', user.id, '/api/user/profile', 'GET');
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    logInfo('profile_accessed', 'User profile accessed', {
      userId: user.id,
      userEmail: user.email,
    });

    return NextResponse.json({
      ...userData,
      memberSince: formatDateInputValue(userData.memberSince),
      dateOfBirth: formatDateInputValue(userData.dateOfBirth),
    });
  } catch (error: unknown) {
    return handleApiError(error, "GET");
  }
}

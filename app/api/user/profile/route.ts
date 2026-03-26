import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { validateUpdateProfileRequest, type UpdateProfileRequest } from "@/lib/user-validation";
import { parseJsonBody, validateRequestBody, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { logInfo, logValidationFailure, logResourceNotFound, maskEmail } from "@/lib/logger";
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

const updateProfileSchema = {
  email: { type: "string" as const, optional: true },
  name: { type: "string" as const, optional: true },
  address: { type: "string" as const, optional: true },
  phone: { type: "string" as const, optional: true },
  memberSince: { type: "string" as const, optional: true },
  dateOfBirth: { type: "string" as const, optional: true },
  rank: { type: "string" as const, optional: true },
  pk: { type: "string" as const, optional: true },
  reservistsAssociation: { type: "string" as const, optional: true },
  associationMemberNumber: { type: "string" as const, optional: true },
  hasPossessionCard: { type: "boolean" as const, optional: true },
} as const;

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireMember();
  const body = await parseJsonBody<UpdateProfileRequest>(request);

  const bodyValidation = validateRequestBody(body, updateProfileSchema, { route: "/api/user/profile", method: "PUT" });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const validation = validateUpdateProfileRequest(body);
  if (!validation.isValid) {
    logValidationFailure("/api/user/profile", "PUT", validation.errors, { userId: user.id });
    return NextResponse.json({ error: validation.errors.join(". "), fieldErrors: validation.fieldErrors }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = String(body.name).trim() || null;
  if (body.address !== undefined) updateData.address = String(body.address).trim() || null;
  if (body.phone !== undefined) updateData.phone = String(body.phone).trim() || null;
  if (body.email !== undefined) updateData.email = String(body.email).trim().toLowerCase();
  if (body.memberSince !== undefined) updateData.memberSince = body.memberSince.trim() ? new Date(body.memberSince) : null;
  if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth.trim() ? new Date(body.dateOfBirth) : null;
  if (body.rank !== undefined) updateData.rank = String(body.rank).trim() || null;
  if (body.pk !== undefined) updateData.pk = String(body.pk).trim() || null;
  if (body.reservistsAssociation !== undefined) updateData.reservistsAssociation = String(body.reservistsAssociation).trim() || null;
  if (body.associationMemberNumber !== undefined) updateData.associationMemberNumber = String(body.associationMemberNumber).trim() || null;
  if (body.hasPossessionCard !== undefined) updateData.hasPossessionCard = body.hasPossessionCard;

  let updatedUser;
  try {
    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: USER_SELECT_FIELDS,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "E-Mail-Adresse wird bereits verwendet" }, { status: 409 });
    }
    throw error;
  }

  const changedFields = Object.keys(updateData);
  logInfo("profile_updated", "User profile updated", {
    userId: user.id,
    userEmail: maskEmail(user.email),
    changedFields,
  });

  return NextResponse.json({
    ...updatedUser,
    memberSince: formatDateInputValue(updatedUser.memberSince),
    dateOfBirth: formatDateInputValue(updatedUser.dateOfBirth),
  });
}, { route: "/api/user/profile", method: "PUT" });

export const GET = withApiErrorHandling(async () => {
  const user = await requireMember();

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: USER_SELECT_FIELDS,
  });

  if (!userData) {
    logResourceNotFound("user", user.id, "/api/user/profile", "GET");
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  logInfo("profile_accessed", "User profile accessed", {
    userId: user.id,
    userEmail: maskEmail(user.email),
  });

  return NextResponse.json({
    ...userData,
    memberSince: formatDateInputValue(userData.memberSince),
    dateOfBirth: formatDateInputValue(userData.dateOfBirth),
  });
}, { route: "/api/user/profile", method: "GET" });

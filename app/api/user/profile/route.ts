import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { validateUpdateProfileRequest, type UpdateProfileRequest } from "@/lib/user-validation";
import { Prisma } from "@prisma/client";
import { BadRequestError, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logValidationFailure, logResourceNotFound } from "@/lib/logger";

const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  address: true,
  phone: true,
  role: true,
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

    const { name, address, phone, email } = body;
    const normalizedEmail =
      email !== undefined ? String(email).trim().toLowerCase() : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(address !== undefined && { address: String(address).trim() }),
        ...(phone !== undefined && { phone: String(phone).trim() }),
        ...(normalizedEmail !== undefined && { email: normalizedEmail }),
      },
      select: USER_SELECT_FIELDS,
    });

    const changedFields: string[] = [];
    if (name !== undefined) changedFields.push('name');
    if (address !== undefined) changedFields.push('address');
    if (phone !== undefined) changedFields.push('phone');
    if (email !== undefined) changedFields.push('email');

    logInfo('profile_updated', 'User profile updated', {
      userId: user.id,
      userEmail: user.email,
      changedFields,
    });

    return NextResponse.json(updatedUser);
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

    return NextResponse.json(userData);
  } catch (error: unknown) {
    return handleApiError(error, "GET");
  }
}

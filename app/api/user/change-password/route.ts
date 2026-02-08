import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { validateChangePasswordRequest, type ChangePasswordRequest } from "@/lib/user-validation";
import { BadRequestError, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { hash, compare } from "bcryptjs";
import { logInfo, logValidationFailure } from "@/lib/logger";

const changePasswordSchema = {
  currentPassword: { type: 'string' as const },
  newPassword: { type: 'string' as const },
  confirmPassword: { type: 'string' as const },
} as const;

export async function PUT(request: NextRequest) {
  try {
    validateCsrfHeaders(request);

    const user = await requireAuth();
    const body = await parseJsonBody<ChangePasswordRequest>(request);

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, changePasswordSchema, { route: '/api/user/change-password', method: 'PUT' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const validation = validateChangePasswordRequest(body);
    if (!validation.isValid) {
      logValidationFailure('/api/user/change-password', 'PUT', validation.errors, { userId: user.id });
      return NextResponse.json(
        { error: validation.errors.join(". ") },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = body;

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    const isPasswordValid = await compare(currentPassword, currentUser.password);
    if (!isPasswordValid) {
      logValidationFailure('/api/user/change-password', 'PUT', 'Aktuelles Passwort ist falsch', { userId: user.id });
      return NextResponse.json(
        { error: "Aktuelles Passwort ist falsch" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    logInfo('password_changed', 'User password changed', {
      userId: user.id,
      userEmail: user.email,
    });

    return NextResponse.json({ message: "Passwort wurde erfolgreich geändert" });
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logApiError(error, {
      route: "/api/user/change-password",
      method: "PUT",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

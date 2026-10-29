import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { validateChangePasswordRequest, type ChangePasswordRequest } from "@/lib/user-validation";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { hash, compare } from "bcryptjs";
import { logInfo, logValidationFailure, maskEmail } from "@/lib/logger";
import { createPasswordChangeProof } from "@/lib/auth-proof";
import { toPasswordStamp } from "@/lib/auth-config";

const ROUTE = "/api/user/change-password";

const changePasswordSchema = {
  currentPassword: { type: 'string' as const },
  newPassword: { type: 'string' as const },
  confirmPassword: { type: 'string' as const },
} as const;

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireMember();
  const body = await parseAndValidateBody<ChangePasswordRequest>(request, changePasswordSchema, { route: ROUTE, method: 'PUT' });

  const validation = validateChangePasswordRequest(body);
  if (!validation.isValid) {
    logValidationFailure(ROUTE, 'PUT', validation.errors, { userId: user.id });
    throw new ValidationError(validation.errors);
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
    logValidationFailure(ROUTE, 'PUT', 'Aktuelles Passwort ist falsch', { userId: user.id });
    return NextResponse.json(
      { error: "Aktuelles Passwort ist falsch" },
      { status: 400 }
    );
  }

  const hashedPassword = await hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordUpdatedAt: new Date(),
    },
    select: { passwordUpdatedAt: true },
  });
  const passwordStamp = toPasswordStamp(updatedUser.passwordUpdatedAt);

  logInfo('password_changed', 'User password changed', {
    userId: user.id,
    userEmail: maskEmail(user.email),
  });

  return NextResponse.json({
    message: "Passwort wurde erfolgreich geändert",
    ...(!user.isImpersonating && passwordStamp !== null
      ? { passwordChangeProof: createPasswordChangeProof(user.id, passwordStamp) }
      : {}),
  });
}, { route: ROUTE, method: "PUT" });

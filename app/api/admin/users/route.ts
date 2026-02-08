import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { validateEmail, normalizeOptionalField, validateAddress, validatePhone, validateName } from "@/lib/user-validation";
import { validateRole } from "@/lib/validation-schema";
import { requireAdmin } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { parseJsonBody, BadRequestError, withApiErrorHandling, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { logValidationFailure, logInfo } from "@/lib/logger";
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

interface CreateUserRequest {
  email: string;
  name: string;
  role?: Role;
  address?: string;
  phone?: string;
}

const createUserSchema = {
  email: { type: 'string' as const },
  name: { type: 'string' as const },
  role: { type: 'string' as const, optional: true },
  address: { type: 'string' as const, optional: true },
  phone: { type: 'string' as const, optional: true },
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        address: true,
        phone: true,
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

  return NextResponse.json(newUser, { status: 201 });
}, { route: "/api/admin/users", method: "POST" });

export const GET = withApiErrorHandling(async () => {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      address: true,
      phone: true,
      createdAt: true,
    },
  });

  logInfo('admin_users_list', 'Admin accessed user list', {
    adminId: admin.id,
    adminEmail: admin.email,
    userCount: users.length,
  });

  return NextResponse.json(users);
}, { route: "/api/admin/users", method: "GET" });

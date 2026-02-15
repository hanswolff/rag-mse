import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BadRequestError, getClientIp, handleRateLimitBlocked, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { hash } from "bcryptjs";
import { validatePassword } from "@/lib/password-validation";
import { hashInvitationToken } from "@/lib/invitations";
import { logInfo, logValidationFailure, logResourceNotFound, maskToken } from "@/lib/logger";
import { Role } from "@prisma/client";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";
import {
  normalizeOptionalField,
  validateAddress,
  validateName,
  validatePhone,
  validateRank,
  validatePk,
  validateReservistsAssociation,
  validateAssociationMemberNumber,
  validateDateOfBirth,
} from "@/lib/user-validation";
import { formatDateInputValue } from "@/lib/date-picker-utils";

const BCRYPT_SALT_ROUNDS = 10;

const INVITATION_NOT_FOUND = "INVITATION_NOT_FOUND";
const INVITATION_ALREADY_USED = "INVITATION_ALREADY_USED";
const INVITATION_EXPIRED = "INVITATION_EXPIRED";

const ERROR_MESSAGES = {
  invalidToken: "Einladung ungültig",
  tokenExpired: "Einladung ist abgelaufen",
  tokenAlreadyUsed: "Einladung wurde bereits verwendet",
  nameRequired: "Name ist erforderlich",
  passwordMismatch: "Passwörter stimmen nicht überein",
  serverError: "Ein Fehler ist aufgetreten",
  accountCreated: "Konto wurde erstellt",
  accountUpdated: "Konto wurde aktualisiert",
} as const;

interface InviteAcceptanceRequest {
  name: string;
  address: string;
  phone: string;
  password: string;
  confirmPassword: string;
  dateOfBirth?: string;
  rank?: string;
  pk?: string;
  reservistsAssociation?: string;
  associationMemberNumber?: string;
  hasPossessionCard?: boolean;
}

const inviteAcceptanceSchema = {
  name: { type: 'string' as const },
  address: { type: 'string' as const, optional: true },
  phone: { type: 'string' as const, optional: true },
  password: { type: 'string' as const },
  confirmPassword: { type: 'string' as const },
  dateOfBirth: { type: 'string' as const, optional: true },
  rank: { type: 'string' as const, optional: true },
  pk: { type: 'string' as const, optional: true },
  reservistsAssociation: { type: 'string' as const, optional: true },
  associationMemberNumber: { type: 'string' as const, optional: true },
  hasPossessionCard: { type: 'boolean' as const, optional: true },
} as const;

function normalizeName(value: string): string {
  return value.trim();
}

interface Invitation {
  email: string;
  id: string;
  role: Role;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  address?: string | null;
  phone?: string | null;
}

interface RedemptionResult {
  user: User;
  isNew: boolean;
}

async function redeemInvitationForExistingUser(
  tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  invitationId: string,
  name: string,
  address: string,
  phone: string,
  password: string,
  dateOfBirth?: string,
  rank?: string,
  pk?: string,
  reservistsAssociation?: string,
  associationMemberNumber?: string,
  hasPossessionCard?: boolean
): Promise<RedemptionResult> {
  const user = await tx.user.update({
    where: { id: userId },
    data: {
      name: normalizeName(name),
      address: address || null,
      phone: phone || null,
      password: await hash(password, BCRYPT_SALT_ROUNDS),
      passwordUpdatedAt: new Date(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      rank: rank || null,
      pk: pk || null,
      reservistsAssociation: reservistsAssociation || null,
      associationMemberNumber: associationMemberNumber || null,
      hasPossessionCard: hasPossessionCard || false,
    },
    select: { id: true, email: true, name: true },
  });

  await tx.invitation.update({
    where: { id: invitationId },
    data: { usedAt: new Date() },
  });

  return { user, isNew: false };
}

async function createUserWithInvitation(
  tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  invitation: Invitation,
  name: string,
  address: string,
  phone: string,
  password: string,
  dateOfBirth?: string,
  rank?: string,
  pk?: string,
  reservistsAssociation?: string,
  associationMemberNumber?: string,
  hasPossessionCard?: boolean
): Promise<RedemptionResult> {
  const hashedPassword = await hash(password, BCRYPT_SALT_ROUNDS);
  const normalizedName = normalizeName(name);

  const user = await tx.user.create({
    data: {
      email: invitation.email,
      name: normalizedName,
      address: address || null,
      phone: phone || null,
      password: hashedPassword,
      passwordUpdatedAt: new Date(),
      role: invitation.role,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      rank: rank || null,
      pk: pk || null,
      reservistsAssociation: reservistsAssociation || null,
      associationMemberNumber: associationMemberNumber || null,
      hasPossessionCard: hasPossessionCard || false,
    },
    select: { id: true, email: true, name: true },
  });

  await tx.invitation.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() },
  });

  return { user, isNew: true };
}

async function validateInvitationInTransaction(
  tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  invitationId: string,
  token: string
) {
  const invitation = await tx.invitation.findUnique({
    where: { id: invitationId },
    select: { usedAt: true, expiresAt: true },
  });

  if (!invitation) {
    logResourceNotFound('invitation', maskToken(token), '/api/invitations/[token]', 'POST', {
      reason: 'not_found_in_transaction',
    });
    throw new Error(INVITATION_NOT_FOUND);
  }

  if (invitation.usedAt) {
    logResourceNotFound('invitation', maskToken(token), '/api/invitations/[token]', 'POST', {
      reason: 'already_used',
    });
    throw new Error(INVITATION_ALREADY_USED);
  }

  if (invitation.expiresAt <= new Date()) {
    logResourceNotFound('invitation', maskToken(token), '/api/invitations/[token]', 'POST', {
      reason: 'expired',
    });
    throw new Error(INVITATION_EXPIRED);
  }

  return invitation;
}

function createInvitationSuccessResponse(result: RedemptionResult) {
  const action = result.isNew ? 'created' : 'updated';
  const message = result.isNew ? ERROR_MESSAGES.accountCreated : ERROR_MESSAGES.accountUpdated;

  logInfo('invitation_accepted', `Invitation accepted and account ${action}`, {
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
  });

  return NextResponse.json({
    message,
    email: result.user.email,
  });
}

async function findValidInvitation(token: string) {
  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    return { invitation: null, status: 404 };
  }

  if (invitation.usedAt) {
    return { invitation: null, status: 410 };
  }

  if (invitation.expiresAt <= new Date()) {
    return { invitation: null, status: 410 };
  }

  return { invitation, status: 200 };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidToken }, { status: 400 });
    }

    const { invitation, status } = await findValidInvitation(token);
    if (!invitation) {
      const message = status === 410 ? ERROR_MESSAGES.tokenExpired : ERROR_MESSAGES.invalidToken;
      return NextResponse.json({ error: message }, { status });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: {
        name: true,
        address: true,
        phone: true,
        memberSince: true,
        dateOfBirth: true,
        rank: true,
        pk: true,
        reservistsAssociation: true,
        associationMemberNumber: true,
        hasPossessionCard: true,
      },
    });

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      name: existingUser?.name ?? "",
      address: existingUser?.address ?? "",
      phone: existingUser?.phone ?? "",
      memberSince: formatDateInputValue(existingUser?.memberSince) ?? "",
      dateOfBirth: formatDateInputValue(existingUser?.dateOfBirth) ?? "",
      rank: existingUser?.rank ?? "",
      pk: existingUser?.pk ?? "",
      reservistsAssociation: existingUser?.reservistsAssociation ?? "",
      associationMemberNumber: existingUser?.associationMemberNumber ?? "",
      hasPossessionCard: existingUser?.hasPossessionCard ?? false,
    });
  } catch (error) {
    logApiError(error, {
      route: "/api/invitations/[token]",
      method: "GET",
      status: 500,
    });
    return NextResponse.json({ error: ERROR_MESSAGES.serverError }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  try {
    validateCsrfHeaders(request);

    if (!token) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidToken }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const tokenHash = hashInvitationToken(token);
    const rateLimitResult = await checkTokenRateLimit(clientIp, tokenHash);

    if (!rateLimitResult.allowed) {
      return handleRateLimitBlocked(
        'invitation_rate_limited',
        '/api/invitations/[token]',
        token,
        clientIp,
        rateLimitResult.blockedUntil,
        rateLimitResult.attemptCount
      );
    }

    const body = await parseJsonBody<InviteAcceptanceRequest>(request);

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, inviteAcceptanceSchema, { route: '/api/invitations/[token]', method: 'POST' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const address = normalizeOptionalField(body.address);
    const phone = normalizeOptionalField(body.phone);
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth : undefined;
    const rank = typeof body.rank === "string" ? body.rank : undefined;
    const pk = typeof body.pk === "string" ? body.pk : undefined;
    const reservistsAssociation = typeof body.reservistsAssociation === "string" ? body.reservistsAssociation : undefined;
    const associationMemberNumber = typeof body.associationMemberNumber === "string" ? body.associationMemberNumber : undefined;
    const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : false;

    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      logValidationFailure('/api/invitations/[token]', 'POST', nameValidation.error || ERROR_MESSAGES.nameRequired, { token: maskToken(token) });
      return NextResponse.json({ error: nameValidation.error || ERROR_MESSAGES.nameRequired }, { status: 400 });
    }

    if (address !== null) {
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', addressValidation.error || "Ungültige Adresse", { token: maskToken(token) });
        return NextResponse.json({ error: addressValidation.error || "Ungültige Adresse" }, { status: 400 });
      }
    }

    if (phone !== null) {
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', phoneValidation.error || "Ungültige Telefonnummer", { token: maskToken(token) });
        return NextResponse.json({ error: phoneValidation.error || "Ungültige Telefonnummer" }, { status: 400 });
      }
    }

    // Validate new profile fields
    if (dateOfBirth !== undefined) {
      const dateOfBirthValidation = validateDateOfBirth(dateOfBirth);
      if (!dateOfBirthValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', dateOfBirthValidation.error || 'Ungültiges Geburtsdatum', { token: maskToken(token) });
        return NextResponse.json({ error: dateOfBirthValidation.error || "Ungültiges Geburtsdatum" }, { status: 400 });
      }
    }

    if (rank !== undefined) {
      const rankValidation = validateRank(rank);
      if (!rankValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', rankValidation.error || 'Ungültiger Dienstgrad', { token: maskToken(token) });
        return NextResponse.json({ error: rankValidation.error }, { status: 400 });
      }
    }

    if (pk !== undefined) {
      const pkValidation = validatePk(pk);
      if (!pkValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', pkValidation.error || 'Ungültige PK', { token: maskToken(token) });
        return NextResponse.json({ error: pkValidation.error }, { status: 400 });
      }
    }

    if (reservistsAssociation !== undefined) {
      const reservistsAssociationValidation = validateReservistsAssociation(reservistsAssociation);
      if (!reservistsAssociationValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', reservistsAssociationValidation.error || 'Ungültige Reservistenkameradschaft', { token: maskToken(token) });
        return NextResponse.json({ error: reservistsAssociationValidation.error }, { status: 400 });
      }
    }

    if (associationMemberNumber !== undefined) {
      const associationMemberNumberValidation = validateAssociationMemberNumber(associationMemberNumber);
      if (!associationMemberNumberValidation.isValid) {
        logValidationFailure('/api/invitations/[token]', 'POST', associationMemberNumberValidation.error || 'Ungültige Mitgliedsnummer im Verband', { token: maskToken(token) });
        return NextResponse.json({ error: associationMemberNumberValidation.error }, { status: 400 });
      }
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      logValidationFailure('/api/invitations/[token]', 'POST', passwordValidation.errors, { token: maskToken(token) });
      return NextResponse.json({ error: passwordValidation.errors.join(". ") }, { status: 400 });
    }

    if (password !== confirmPassword) {
      logValidationFailure('/api/invitations/[token]', 'POST', ERROR_MESSAGES.passwordMismatch, { token: maskToken(token) });
      return NextResponse.json({ error: ERROR_MESSAGES.passwordMismatch }, { status: 400 });
    }

    const { invitation, status } = await findValidInvitation(token);
    if (!invitation) {
      const message = status === 410 ? ERROR_MESSAGES.tokenExpired : ERROR_MESSAGES.invalidToken;
      logResourceNotFound('invitation', maskToken(token), '/api/invitations/[token]', 'POST', {
        reason: status === 410 ? 'expired' : 'invalid',
      });
      return NextResponse.json({ error: message }, { status });
    }

    const result = await prisma.$transaction(async (tx: Omit<typeof prisma, "\$connect" | "\$disconnect" | "\$on" | "\$transaction" | "\$extends">) => {
      await validateInvitationInTransaction(tx, invitation.id, token);

      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      });

      if (existingUser) {
        return redeemInvitationForExistingUser(
          tx,
          existingUser.id,
          invitation.id,
          name,
          address ?? "",
          phone ?? "",
          password,
          dateOfBirth,
          rank,
          pk,
          reservistsAssociation,
          associationMemberNumber,
          hasPossessionCard
        );
      }

      return createUserWithInvitation(
        tx,
        invitation,
        name,
        address ?? "",
        phone ?? "",
        password,
        dateOfBirth,
        rank,
        pk,
        reservistsAssociation,
        associationMemberNumber,
        hasPossessionCard
      );
    });

    await recordSuccessfulTokenUsage(tokenHash, clientIp);

    return createInvitationSuccessResponse(result);
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === INVITATION_NOT_FOUND) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidToken }, { status: 404 });
    }

    if (error instanceof Error && error.message === INVITATION_ALREADY_USED) {
      return NextResponse.json({ error: ERROR_MESSAGES.tokenAlreadyUsed }, { status: 410 });
    }

    if (error instanceof Error && error.message === INVITATION_EXPIRED) {
      return NextResponse.json({ error: ERROR_MESSAGES.tokenExpired }, { status: 410 });
    }

    logApiError(error, {
      route: "/api/invitations/[token]",
      method: "POST",
      status: 500,
    });
    return NextResponse.json({ error: ERROR_MESSAGES.serverError }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BadRequestError,
  getClientIp,
  getNoCacheHeaders,
  handleRateLimitBlocked,
  logApiError,
  parseJsonBody,
  checkTokenRateLimitWithPolicy,
  recordSuccessfulTokenUsageWithPolicy,
  validateRequestBody,
  validateCsrfHeaders,
} from "@/lib/api-utils";
import { validatePassword } from "@/lib/password-validation";
import { hashInvitationToken } from "@/lib/invitations";
import { logInfo, logValidationFailure, logResourceNotFound, maskToken } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import {
  normalizeOptionalField,
  validateName,
} from "@/lib/user-validation";
import { formatDateInputValue } from "@/lib/date-picker-utils";
import { validateOptionalProfileFields } from "@/lib/profile-fields";
import {
  findValidInvitation,
  INVITATION_ALREADY_USED,
  INVITATION_ERROR_MESSAGES,
  INVITATION_EXPIRED,
  INVITATION_NOT_FOUND,
  redeemInvitationInTransaction,
  type RedemptionResult,
  validateInvitationInTransaction,
} from "@/lib/invitation-redemption";

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

function createInvitationSuccessResponse(result: RedemptionResult) {
  const action = result.isNew ? 'created' : 'updated';
  const message = result.isNew ? INVITATION_ERROR_MESSAGES.accountCreated : INVITATION_ERROR_MESSAGES.accountUpdated;

  logInfo('invitation_accepted', `Invitation accepted and account ${action}`, {
    userId: result.user.id,
    email: "masked",
  });

  return NextResponse.json({
    message,
    email: result.user.email,
  });
}


export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.invalidToken }, { status: 400, headers: getNoCacheHeaders() });
    }

    const { invitation, status } = await findValidInvitation(token);
    if (!invitation) {
      const message = status === 410 ? INVITATION_ERROR_MESSAGES.tokenExpired : INVITATION_ERROR_MESSAGES.invalidToken;
      return NextResponse.json({ error: message }, { status, headers: getNoCacheHeaders() });
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

    return NextResponse.json(
      {
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
      },
      { headers: getNoCacheHeaders() }
    );
  } catch (error) {
    logApiError(error, {
      route: "/api/invitations/[token]",
      method: "GET",
      status: 500,
    });
    return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.serverError }, { status: 500, headers: getNoCacheHeaders() });
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
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.invalidToken }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const tokenHash = hashInvitationToken(token);
    const rateLimitResult = await checkTokenRateLimitWithPolicy(
      "/api/invitations/[token]",
      "POST",
      clientIp,
      tokenHash,
      maskToken(token)
    );

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

    const bodyValidation = validateRequestBody(body, inviteAcceptanceSchema, { route: '/api/invitations/[token]', method: 'POST' });
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
    const dateOfBirth = normalizeOptionalField(typeof body.dateOfBirth === "string" ? body.dateOfBirth : undefined);
    const rank = normalizeOptionalField(typeof body.rank === "string" ? body.rank : undefined);
    const pk = normalizeOptionalField(typeof body.pk === "string" ? body.pk : undefined);
    const reservistsAssociation = normalizeOptionalField(typeof body.reservistsAssociation === "string" ? body.reservistsAssociation : undefined);
    const associationMemberNumber = normalizeOptionalField(typeof body.associationMemberNumber === "string" ? body.associationMemberNumber : undefined);
    const hasPossessionCard = typeof body.hasPossessionCard === "boolean" ? body.hasPossessionCard : false;

    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      logValidationFailure('/api/invitations/[token]', 'POST', nameValidation.error || INVITATION_ERROR_MESSAGES.nameRequired, { token: maskToken(token) });
      return NextResponse.json({ error: nameValidation.error || INVITATION_ERROR_MESSAGES.nameRequired }, { status: 400 });
    }

    const optionalProfileFieldError = validateOptionalProfileFields({
      address,
      phone,
      dateOfBirth,
      rank,
      pk,
      reservistsAssociation,
      associationMemberNumber,
    });
    if (optionalProfileFieldError) {
      logValidationFailure('/api/invitations/[token]', 'POST', optionalProfileFieldError.message, {
        token: maskToken(token),
        field: optionalProfileFieldError.field,
      });
      return NextResponse.json({ error: optionalProfileFieldError.message }, { status: 400 });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      logValidationFailure('/api/invitations/[token]', 'POST', passwordValidation.errors, { token: maskToken(token) });
      return NextResponse.json({ error: passwordValidation.errors.join(". ") }, { status: 400 });
    }

    if (password !== confirmPassword) {
      logValidationFailure('/api/invitations/[token]', 'POST', INVITATION_ERROR_MESSAGES.passwordMismatch, { token: maskToken(token) });
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.passwordMismatch }, { status: 400 });
    }

    const { invitation, status } = await findValidInvitation(token);
    if (!invitation) {
      const message = status === 410 ? INVITATION_ERROR_MESSAGES.tokenExpired : INVITATION_ERROR_MESSAGES.invalidToken;
      logResourceNotFound('invitation', maskToken(token), '/api/invitations/[token]', 'POST', {
        reason: status === 410 ? 'expired' : 'invalid',
      });
      return NextResponse.json({ error: message }, { status });
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await validateInvitationInTransaction(tx, invitation.id, token);
      return redeemInvitationInTransaction(
        tx,
        invitation,
        {
          name,
          address,
          phone,
          password,
          dateOfBirth,
          rank,
          pk,
          reservistsAssociation,
          associationMemberNumber,
          hasPossessionCard,
        }
      );
    });

    await recordSuccessfulTokenUsageWithPolicy(
      "/api/invitations/[token]",
      "POST",
      tokenHash,
      clientIp,
      maskToken(token)
    );

    return createInvitationSuccessResponse(result);
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === INVITATION_NOT_FOUND) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.invalidToken }, { status: 404 });
    }

    if (error instanceof Error && error.message === INVITATION_ALREADY_USED) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.tokenAlreadyUsed }, { status: 410 });
    }

    if (error instanceof Error && error.message === INVITATION_EXPIRED) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.tokenExpired }, { status: 410 });
    }

    logApiError(error, {
      route: "/api/invitations/[token]",
      method: "POST",
      status: 500,
    });
    return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.serverError }, { status: 500 });
  }
}

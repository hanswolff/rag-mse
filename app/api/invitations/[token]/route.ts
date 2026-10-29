import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNoCacheHeaders } from "@/lib/api-error-handler";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { recordSuccessfulTokenUsageWithPolicy, withTokenRateLimit } from "@/lib/api-utils";
import { validatePassword } from "@/lib/password-validation";
import { hashInvitationToken } from "@/lib/invitations";
import { logInfo, logValidationFailure, logResourceNotFound, maskToken } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { parseUserPayload, userPayloadErrorResponse, type InvitationProfilePayload } from "@/lib/user-payload";
import {
  findValidInvitation,
  hashRedemptionPassword,
  INVITATION_ERROR_MESSAGES,
  redeemInvitationInTransaction,
  type RedemptionResult,
  validateInvitationInTransaction,
} from "@/lib/invitation-redemption";
import { InvitationNotFoundError, InvitationAlreadyUsedError, InvitationExpiredError } from "@/lib/errors";

const ROUTE = "/api/invitations/[token]";

type InviteAcceptanceRequest = InvitationProfilePayload & {
  password: string;
  confirmPassword: string;
};

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


export const GET = withTokenRateLimit({
  route: ROUTE,
  method: "GET",
  action: "invitation_rate_limited",
  hashToken: hashInvitationToken,
  kind: "read",
  invalidTokenMessage: INVITATION_ERROR_MESSAGES.invalidToken,
  invalidTokenNoCache: true,
}, async (_request: NextRequest, { token }) => {
  const { invitation, status } = await findValidInvitation(token);
  if (!invitation) {
    const message = status === 410 ? INVITATION_ERROR_MESSAGES.tokenExpired : INVITATION_ERROR_MESSAGES.invalidToken;
    return NextResponse.json({ error: message }, { status, headers: getNoCacheHeaders() });
  }

  // Bewusst nur die zum Ausfüllen des Formulars nötigen Felder: Der Link ist
  // unauthentifiziert, gespeicherte Stammdaten (Adresse, Geburtsdatum, Telefon)
  // gehören nicht in die Antwort.
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { name: true },
  });

  return NextResponse.json(
    {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      name: existingUser?.name ?? "",
    },
    { headers: getNoCacheHeaders() }
  );
});

export const POST = withTokenRateLimit({
  route: ROUTE,
  method: "POST",
  action: "invitation_rate_limited",
  hashToken: hashInvitationToken,
  requireCsrf: true,
  invalidTokenMessage: INVITATION_ERROR_MESSAGES.invalidToken,
}, async (request: NextRequest, { token, tokenHash, clientIp }) => {
  const body = await parseAndValidateBody<InviteAcceptanceRequest>(request, inviteAcceptanceSchema, { route: ROUTE, method: 'POST' });

  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  const parsed = await parseUserPayload(body, { mode: "invitation" });
  if (parsed.error) {
    return userPayloadErrorResponse(parsed.error, {
      route: ROUTE,
      method: "POST",
      context: { token: maskToken(token) },
    });
  }
  const profile = parsed.data;

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    logValidationFailure(ROUTE, 'POST', passwordValidation.errors, { token: maskToken(token) });
    const fieldErrors = passwordValidation.errors.map((msg) => ({ field: "password", message: msg }));
    throw new ValidationError(passwordValidation.errors, { fieldErrors });
  }

  if (password !== confirmPassword) {
    logValidationFailure(ROUTE, 'POST', INVITATION_ERROR_MESSAGES.passwordMismatch, { token: maskToken(token) });
    throw new ValidationError([INVITATION_ERROR_MESSAGES.passwordMismatch], { fieldErrors: [{ field: "confirmPassword", message: INVITATION_ERROR_MESSAGES.passwordMismatch }] });
  }

  const { invitation, status } = await findValidInvitation(token);
  if (!invitation) {
    const message = status === 410 ? INVITATION_ERROR_MESSAGES.tokenExpired : INVITATION_ERROR_MESSAGES.invalidToken;
    logResourceNotFound('invitation', maskToken(token), ROUTE, 'POST', {
      reason: status === 410 ? 'expired' : 'invalid',
    });
    return NextResponse.json({ error: message }, { status });
  }

  const passwordHash = await hashRedemptionPassword(password);

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await validateInvitationInTransaction(tx, invitation.id, token);
      return redeemInvitationInTransaction(tx, invitation, {
        ...profile,
        passwordHash,
      });
    });

    await recordSuccessfulTokenUsageWithPolicy(
      ROUTE,
      "POST",
      tokenHash,
      clientIp,
      maskToken(token)
    );

    return createInvitationSuccessResponse(result);
  } catch (error: unknown) {
    if (error instanceof InvitationNotFoundError) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.invalidToken }, { status: 404 });
    }
    if (error instanceof InvitationAlreadyUsedError) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.tokenAlreadyUsed }, { status: 410 });
    }
    if (error instanceof InvitationExpiredError) {
      return NextResponse.json({ error: INVITATION_ERROR_MESSAGES.tokenExpired }, { status: 410 });
    }
    throw error;
  }
});

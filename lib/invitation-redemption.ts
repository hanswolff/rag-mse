import { hash } from "bcryptjs";
import { Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashInvitationToken } from "@/lib/invitations";
import { logResourceNotFound, maskToken } from "@/lib/logger";

const BCRYPT_SALT_ROUNDS = 10;

export const INVITATION_NOT_FOUND = "INVITATION_NOT_FOUND";
export const INVITATION_ALREADY_USED = "INVITATION_ALREADY_USED";
export const INVITATION_EXPIRED = "INVITATION_EXPIRED";

export const INVITATION_ERROR_MESSAGES = {
  invalidToken: "Einladung ungültig",
  tokenExpired: "Einladung ist abgelaufen",
  tokenAlreadyUsed: "Einladung wurde bereits verwendet",
  nameRequired: "Name ist erforderlich",
  passwordMismatch: "Passwörter stimmen nicht überein",
  serverError: "Ein Fehler ist aufgetreten",
  accountCreated: "Konto wurde erstellt",
  accountUpdated: "Konto wurde aktualisiert",
} as const;

type InvitationIdentity = {
  id: string;
  email: string;
  role: Role;
};

type RedeemProfileInput = {
  name: string;
  address: string | null;
  phone: string | null;
  password: string;
  dateOfBirth?: string | null;
  rank?: string | null;
  pk?: string | null;
  reservistsAssociation?: string | null;
  associationMemberNumber?: string | null;
  hasPossessionCard?: boolean;
};

type RedemptionUser = {
  id: string;
  email: string;
  name: string | null;
};

export type RedemptionResult = {
  user: RedemptionUser;
  isNew: boolean;
};

function normalizeName(value: string): string {
  return value.trim();
}

function toNullableDate(value?: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toNullableText(value?: string | null): string | null {
  return value || null;
}

function buildProfileUpdateData(input: RedeemProfileInput) {
  return {
    name: normalizeName(input.name),
    address: toNullableText(input.address),
    phone: toNullableText(input.phone),
    passwordUpdatedAt: new Date(),
    dateOfBirth: toNullableDate(input.dateOfBirth),
    rank: toNullableText(input.rank),
    pk: toNullableText(input.pk),
    reservistsAssociation: toNullableText(input.reservistsAssociation),
    associationMemberNumber: toNullableText(input.associationMemberNumber),
    hasPossessionCard: input.hasPossessionCard || false,
  };
}

export async function findValidInvitation(token: string) {
  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    return { invitation: null, status: 404 as const };
  }
  if (invitation.usedAt) {
    return { invitation: null, status: 410 as const };
  }
  if (invitation.expiresAt <= new Date()) {
    return { invitation: null, status: 410 as const };
  }

  return { invitation, status: 200 as const };
}

export async function validateInvitationInTransaction(
  tx: Prisma.TransactionClient,
  invitationId: string,
  token: string
): Promise<void> {
  const invitation = await tx.invitation.findUnique({
    where: { id: invitationId },
    select: { usedAt: true, expiresAt: true },
  });

  if (!invitation) {
    logResourceNotFound("invitation", maskToken(token), "/api/invitations/[token]", "POST", {
      reason: "not_found_in_transaction",
    });
    throw new Error(INVITATION_NOT_FOUND);
  }
  if (invitation.usedAt) {
    logResourceNotFound("invitation", maskToken(token), "/api/invitations/[token]", "POST", {
      reason: "already_used",
    });
    throw new Error(INVITATION_ALREADY_USED);
  }
  if (invitation.expiresAt <= new Date()) {
    logResourceNotFound("invitation", maskToken(token), "/api/invitations/[token]", "POST", {
      reason: "expired",
    });
    throw new Error(INVITATION_EXPIRED);
  }
}

export async function redeemInvitationInTransaction(
  tx: Prisma.TransactionClient,
  invitation: InvitationIdentity,
  profile: RedeemProfileInput
): Promise<RedemptionResult> {
  const passwordHash = await hash(profile.password, BCRYPT_SALT_ROUNDS);
  const profileUpdateData = buildProfileUpdateData(profile);

  const existingUser = await tx.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });

  if (existingUser) {
    const user = await tx.user.update({
      where: { id: existingUser.id },
      data: {
        ...profileUpdateData,
        password: passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });

    return { user, isNew: false };
  }

  const user = await tx.user.create({
    data: {
      email: invitation.email,
      role: invitation.role,
      password: passwordHash,
      ...profileUpdateData,
    },
    select: { id: true, email: true, name: true },
  });

  await tx.invitation.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() },
  });

  return { user, isNew: true };
}

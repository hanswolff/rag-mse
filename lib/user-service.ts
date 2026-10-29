import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logInfo, maskEmail } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";
import { sendRoleChangeEmail } from "@/lib/role-change-email";
import { generateRandomPassword } from "@/lib/crypto-utils";
import {
  buildInviteUrl,
  createInvitationTokenSet,
  invalidateOpenInvitations,
  invalidateOtherOpenInvitations,
  sendInvitationEmail,
} from "@/lib/invitations";
import {
  parseUserPayload,
  type CreateUserData,
  type UpdateUserPayload,
  type UserPayloadError,
} from "@/lib/user-payload";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  LastAdminDeleteBlockedError,
  LastAdminDemotionBlockedError,
  UserNotFoundInTransactionError,
} from "@/lib/errors";

const BCRYPT_SALT_ROUNDS = 10;

export const userAdminSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  address: true,
  phone: true,
  memberSince: true,
  dateOfBirth: true,
  rank: true,
  pk: true,
  reservistsAssociation: true,
  associationMemberNumber: true,
  hasPossessionCard: true,
  adminNotes: true,
  createdAt: true,
} as const;

export type AdminManagedUser = Prisma.UserGetPayload<{ select: typeof userAdminSelect }>;

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

export class SiteAdminUpdateForbiddenError extends Error {
  constructor() {
    super("Site administrator may only be changed by the site administrator");
    this.name = "SiteAdminUpdateForbiddenError";
  }
}

export class SiteAdminDemotionBlockedError extends Error {
  constructor() {
    super("Site administrator demotion blocked");
    this.name = "SiteAdminDemotionBlockedError";
  }
}

export class SiteAdminDeleteBlockedError extends Error {
  constructor() {
    super("Site administrator delete blocked");
    this.name = "SiteAdminDeleteBlockedError";
  }
}

export class DuplicateUserEmailError extends Error {
  constructor() {
    super("A user with this email already exists");
    this.name = "DuplicateUserEmailError";
  }
}

export class InvitationEmailDeliveryError extends Error {
  constructor() {
    super("Invitation email could not be sent");
    this.name = "InvitationEmailDeliveryError";
  }
}

export class UserPayloadInvalidError extends Error {
  constructor(readonly payloadError: UserPayloadError) {
    super(payloadError.message);
    this.name = "UserPayloadInvalidError";
  }
}

type ActingAdmin = {
  id: string;
  role?: string;
  name?: string | null;
  email?: string | null;
  impersonatedBy?: { id: string } | null;
};

type RouteLogContext = { route: string; method: string };

export async function updateUser(
  actingUser: ActingAdmin,
  userId: string,
  body: UpdateUserPayload,
  logContext: RouteLogContext
): Promise<AdminManagedUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  if (user.role === "SITE_ADMINISTRATOR" && actingUser.role !== "SITE_ADMINISTRATOR") {
    throw new SiteAdminUpdateForbiddenError();
  }

  const parsed = await parseUserPayload(body, {
    mode: "update",
    isEmailTaken: async (normalizedEmail) => {
      if (normalizedEmail === user.email) {
        return false;
      }
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      return existingUser !== null;
    },
  });
  if (parsed.error) {
    throw new UserPayloadInvalidError(parsed.error);
  }
  const updates = parsed.data;

  const isAdminDemotion = user.role === "ADMIN" && updates.role !== undefined && updates.role !== "ADMIN";
  const isSiteAdminRoleChange = user.role === "SITE_ADMINISTRATOR" && updates.role !== undefined && updates.role !== "SITE_ADMINISTRATOR";

  if (isSiteAdminRoleChange) {
    throw new SiteAdminDemotionBlockedError();
  }

  const isEmailChange = updates.email !== undefined && updates.email !== user.email;

  const updatedUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (isAdminDemotion) {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!target) {
        throw new UserNotFoundInTransactionError();
      }

      if (target.role === "ADMIN") {
        const adminCount = await tx.user.count({
          where: { role: "ADMIN" },
        });

        if (adminCount <= 1) {
          throw new LastAdminDemotionBlockedError();
        }
      }
    }

    const result = await tx.user.update({
      where: { id: userId },
      data: updates,
      select: userAdminSelect,
    });

    if (isEmailChange) {
      await invalidateOpenInvitations(tx, user.email);
    }

    return result;
  });

  const changedFields: string[] = Object.keys(updates);
  logInfo('user_updated', 'User updated by admin', {
    userId: updatedUser.id,
    changedFields,
    updatedBy: 'admin',
  });

  logAdminAction("user_update", actingUser, {
    targetUserId: updatedUser.id,
    changedFields,
    roleChanged: updates.role ? { from: user.role, to: updates.role } : undefined,
  });

  if (updates.role && user.role !== updates.role) {
    await sendRoleChangeEmail({
      email: updatedUser.email,
      userName: updatedUser.name || updatedUser.email,
      oldRole: user.role,
      newRole: updates.role,
      changedByName: actingUser.name || actingUser.email || "Ein Administrator",
      logContext: {
        route: logContext.route,
        method: logContext.method,
        userId: updatedUser.id,
        userEmail: actingUser.email || undefined,
      },
    });
  }

  return updatedUser;
}

export async function deleteUser(actingAdmin: ActingAdmin, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  if (user.role === "SITE_ADMINISTRATOR") {
    throw new SiteAdminDeleteBlockedError();
  }

  const deletedCount = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    if (!target) {
      return 0;
    }

    if (target.role === "ADMIN") {
      const adminCount = await tx.user.count({
        where: { role: "ADMIN" },
      });

      if (adminCount <= 1) {
        throw new LastAdminDeleteBlockedError();
      }
    }

    await tx.vote.deleteMany({
      where: { userId },
    });

    const result = await tx.user.deleteMany({
      where: { id: userId },
    });

    await invalidateOpenInvitations(tx, target.email);

    return result.count;
  });

  if (deletedCount === 0) {
    throw new UserNotFoundError();
  }

  logInfo('user_deleted', 'User deleted', {
    userId: user.id,
    deletedBy: 'admin',
  });

  logAdminAction("user_delete", actingAdmin, {
    targetUserId: user.id,
    targetRole: user.role,
  });
}

async function rollbackProvisionedUser(userId: string, email: string, tokenHash: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.invitation.deleteMany({
        where: {
          email,
          tokenHash,
        },
      });

      await tx.user.deleteMany({
        where: { id: userId },
      });
    });
  } catch (rollbackError) {
    logInfo("admin_user_create_rollback_failed", "Failed to rollback user provisioning after invitation email error", {
      userId,
      email: maskEmail(email),
      error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
    });
  }
}

export async function provisionUserWithInvitation(
  admin: ActingAdmin,
  data: CreateUserData,
  appUrl: string,
  logContext: RouteLogContext
): Promise<AdminManagedUser> {
  const { email: normalizedEmail, role } = data;

  const randomPassword = generateRandomPassword();
  const hashedPassword = await hash(randomPassword, BCRYPT_SALT_ROUNDS);
  const { token, tokenHash, expiresAt } = createInvitationTokenSet();

  let newUser: AdminManagedUser;
  try {
    newUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          ...data,
          password: hashedPassword,
        },
        select: userAdminSelect,
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

      await invalidateOtherOpenInvitations(tx, normalizedEmail, { tokenHash });

      return user;
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateUserEmailError();
    }
    throw error;
  }

  const inviteUrl = buildInviteUrl(appUrl, token);

  const emailResult = await sendInvitationEmail({
    email: normalizedEmail,
    inviteUrl,
    logContext: {
      route: logContext.route,
      method: logContext.method,
      userId: newUser.id,
      ...(admin.email && { userEmail: maskEmail(admin.email) }),
    },
  });

  if (!emailResult.success) {
    await rollbackProvisionedUser(newUser.id, normalizedEmail, tokenHash);
    throw new InvitationEmailDeliveryError();
  }

  logAdminAction("user_create", admin, {
    targetUserId: newUser.id,
    targetEmail: maskEmail(normalizedEmail),
    targetRole: role,
  });

  return newUser;
}

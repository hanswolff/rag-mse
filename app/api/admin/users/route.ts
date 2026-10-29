import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { getAppUrl } from "@/lib/site-config";
import { logInfo } from "@/lib/logger";
import { formatDateInputValue } from "@/lib/date-picker-utils";
import { sortUsersByRole } from "@/lib/role-utils";
import { parseUserPayload, userPayloadErrorResponse, type CreateUserPayload } from "@/lib/user-payload";
import {
  DuplicateUserEmailError,
  InvitationEmailDeliveryError,
  provisionUserWithInvitation,
  userAdminSelect,
} from "@/lib/user-service";

const ROUTE = "/api/admin/users";

function serializeUserDateFields<T extends { memberSince: Date | null; dateOfBirth: Date | null }>(user: T) {
  return {
    ...user,
    memberSince: formatDateInputValue(user.memberSince),
    dateOfBirth: formatDateInputValue(user.dateOfBirth),
  };
}

const createUserSchema = {
  email: { type: 'string' as const },
  name: { type: 'string' as const },
  role: { type: 'string' as const, optional: true },
  address: { type: 'string' as const, optional: true },
  phone: { type: 'string' as const, optional: true },
  memberSince: { type: 'string' as const, optional: true },
  dateOfBirth: { type: 'string' as const, optional: true },
  rank: { type: 'string' as const, optional: true },
  pk: { type: 'string' as const, optional: true },
  reservistsAssociation: { type: 'string' as const, optional: true },
  associationMemberNumber: { type: 'string' as const, optional: true },
  hasPossessionCard: { type: 'boolean' as const, optional: true },
  adminNotes: { type: 'string' as const, optional: true },
} as const;

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const admin = await requireAdmin("write");

  const body = await parseAndValidateBody<CreateUserPayload>(request, createUserSchema, { route: ROUTE, method: 'POST' });

  const parsed = await parseUserPayload(body, { mode: "create" });
  if (parsed.error) {
    return userPayloadErrorResponse(parsed.error, { route: ROUTE, method: "POST" });
  }
  const { data } = parsed;

  // Bewusste Vereinheitlichung: fehlende APP_URL ist ein Server-Konfigurationsfehler
  // und antwortet wie in den übrigen Einladungs-Routen mit 500 (vorher 400).
  const appUrl = getAppUrl();

  let newUser;
  try {
    newUser = await provisionUserWithInvitation(admin, data, appUrl, { route: ROUTE, method: "POST" });
  } catch (error: unknown) {
    if (error instanceof DuplicateUserEmailError) {
      return NextResponse.json(
        { error: "Ein Benutzer mit dieser E-Mail existiert bereits" },
        { status: 409 }
      );
    }
    if (error instanceof InvitationEmailDeliveryError) {
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut." },
        { status: 500 }
      );
    }
    throw error;
  }

  return NextResponse.json(serializeUserDateFields(newUser), { status: 201 });
}, { route: ROUTE, method: "POST" });

export const GET = withApiErrorHandling(async () => {
  const admin = await requireAdmin("read");

  const users = await prisma.user.findMany({
    select: {
      ...userAdminSelect,
      lastLoginAt: true,
      passwordUpdatedAt: true,
      activatedAt: true,
    },
  });

  const sortedUsers = sortUsersByRole(users);

  logInfo('admin_users_list', 'Admin accessed user list', {
    adminId: admin.id,
    userCount: sortedUsers.length,
  });

  return NextResponse.json(sortedUsers.map((user) => serializeUserDateFields(user)));
}, { route: ROUTE, method: "GET" });

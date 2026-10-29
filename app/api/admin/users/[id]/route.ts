import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logResourceNotFound } from "@/lib/logger";
import { UserNotFoundInTransactionError, LastAdminDemotionBlockedError, LastAdminDeleteBlockedError } from "@/lib/errors";
import { formatDateInputValue } from "@/lib/date-picker-utils";
import { userPayloadErrorResponse, type UpdateUserPayload } from "@/lib/user-payload";
import {
  deleteUser,
  SiteAdminDeleteBlockedError,
  SiteAdminDemotionBlockedError,
  SiteAdminUpdateForbiddenError,
  updateUser,
  UserNotFoundError,
  UserPayloadInvalidError,
} from "@/lib/user-service";

const ROUTE = "/api/admin/users/[id]";

const updateUserSchema = {
  email: { type: 'string' as const, optional: true },
  name: { type: 'string' as const, optional: true },
  address: { type: 'string' as const, optional: true, nullable: true },
  phone: { type: 'string' as const, optional: true, nullable: true },
  role: { type: 'string' as const, optional: true },
  memberSince: { type: 'string' as const, optional: true },
  dateOfBirth: { type: 'string' as const, optional: true },
  rank: { type: 'string' as const, optional: true },
  pk: { type: 'string' as const, optional: true },
  reservistsAssociation: { type: 'string' as const, optional: true },
  associationMemberNumber: { type: 'string' as const, optional: true },
  hasPossessionCard: { type: 'boolean' as const, optional: true },
  adminNotes: { type: 'string' as const, optional: true, nullable: true },
} as const;

export const PATCH = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  validateCsrfHeaders(request);

  const actingUser = await requireAdmin("write");

  const { id } = await context.params;
  const body = await parseAndValidateBody<UpdateUserPayload>(request, updateUserSchema, { route: ROUTE, method: 'PATCH' });

  let updatedUser;
  try {
    updatedUser = await updateUser(actingUser, id, body, { route: ROUTE, method: "PATCH" });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      logResourceNotFound('user', id, ROUTE, 'PATCH');
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }
    if (error instanceof SiteAdminUpdateForbiddenError) {
      return NextResponse.json(
        { error: "Der SiteAdministrator darf nur vom SiteAdministrator geändert werden" },
        { status: 403 }
      );
    }
    if (error instanceof UserPayloadInvalidError) {
      return userPayloadErrorResponse(error.payloadError, {
        route: ROUTE,
        method: "PATCH",
        context: { userId: id },
      });
    }
    if (error instanceof SiteAdminDemotionBlockedError) {
      return NextResponse.json(
        { error: "Der SiteAdministrator darf nicht herabgestuft werden" },
        { status: 403 }
      );
    }
    if (error instanceof LastAdminDemotionBlockedError) {
      return NextResponse.json(
        { error: "Der letzte Administrator darf nicht herabgestuft werden" },
        { status: 403 }
      );
    }
    if (error instanceof UserNotFoundInTransactionError) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }
    throw error;
  }

  return NextResponse.json({
    ...updatedUser,
    memberSince: formatDateInputValue(updatedUser.memberSince),
    dateOfBirth: formatDateInputValue(updatedUser.dateOfBirth),
  });
}, { route: ROUTE, method: "PATCH" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  validateCsrfHeaders(request);

  const actingAdmin = await requireAdmin("write");

  const { id } = await context.params;

  try {
    await deleteUser(actingAdmin, id);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      logResourceNotFound('user', id, ROUTE, 'DELETE');
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }
    if (error instanceof SiteAdminDeleteBlockedError) {
      return NextResponse.json(
        { error: "Der SiteAdministrator darf nicht gelöscht werden" },
        { status: 403 }
      );
    }
    if (error instanceof LastAdminDeleteBlockedError) {
      return NextResponse.json(
        { error: "Der letzte Administrator darf nicht gelöscht werden" },
        { status: 403 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { parseJsonBody, validateRequestBody, withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { validateReminderSettings } from "@/lib/notification-settings";
import { logInfo, logValidationFailure } from "@/lib/logger";

type UpdateNotificationRequest = {
  eventReminderEnabled?: boolean;
  eventReminderDaysBefore?: number;
};

const updateNotificationsSchema = {
  eventReminderEnabled: { type: "boolean" as const, optional: true },
  eventReminderDaysBefore: { type: "number" as const, optional: true },
} as const;

export const GET = withApiErrorHandling(async () => {
  const user = await requireAuth();

  const settings = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      eventReminderEnabled: true,
      eventReminderDaysBefore: true,
    },
  });

  if (!settings) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(settings);
}, { route: "/api/user/notifications", method: "GET" });

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireAuth();
  const body = await parseJsonBody<UpdateNotificationRequest>(request);
  const bodyValidation = validateRequestBody(
    body as unknown as Record<string, unknown>,
    updateNotificationsSchema,
    { route: "/api/user/notifications", method: "PUT" }
  );

  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  if (body.eventReminderEnabled === undefined && body.eventReminderDaysBefore === undefined) {
    return NextResponse.json(
      { error: "Mindestens ein Feld muss aktualisiert werden" },
      { status: 400 }
    );
  }

  const validation = validateReminderSettings(body.eventReminderEnabled, body.eventReminderDaysBefore);
  if (!validation.isValid) {
    logValidationFailure("/api/user/notifications", "PUT", validation.errors, { userId: user.id });
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const updateData: {
    eventReminderEnabled?: boolean;
    eventReminderDaysBefore?: number;
  } = {};

  if (body.eventReminderEnabled !== undefined) {
    updateData.eventReminderEnabled = body.eventReminderEnabled;
  }
  if (body.eventReminderDaysBefore !== undefined) {
    updateData.eventReminderDaysBefore = body.eventReminderDaysBefore;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      eventReminderEnabled: true,
      eventReminderDaysBefore: true,
    },
  });

  logInfo("notification_settings_updated", "Notification settings updated", {
    userId: user.id,
    eventReminderEnabled: updated.eventReminderEnabled,
    eventReminderDaysBefore: updated.eventReminderDaysBefore,
  });

  return NextResponse.json(updated);
}, { route: "/api/user/notifications", method: "PUT" });

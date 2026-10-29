import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { validateReminderSettings } from "@/lib/reminders/notification-settings";
import { logInfo, logValidationFailure } from "@/lib/logger";

const ROUTE = "/api/user/notifications";

type UpdateNotificationRequest = {
  eventReminderEnabled?: boolean;
  eventReminderDaysBefore?: number;
  pollNotificationEnabled?: boolean;
};

const updateNotificationsSchema = {
  eventReminderEnabled: { type: "boolean" as const, optional: true },
  eventReminderDaysBefore: { type: "number" as const, optional: true },
  pollNotificationEnabled: { type: "boolean" as const, optional: true },
} as const;

export const GET = withApiErrorHandling(async () => {
  const user = await requireMember();

  const settings = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      eventReminderEnabled: true,
      eventReminderDaysBefore: true,
      pollNotificationEnabled: true,
    },
  });

  if (!settings) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(settings);
}, { route: ROUTE, method: "GET" });

export const PUT = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);

  const user = await requireMember();
  const body = await parseAndValidateBody<UpdateNotificationRequest>(request, updateNotificationsSchema, { route: ROUTE, method: "PUT" });

  if (body.eventReminderEnabled === undefined && body.eventReminderDaysBefore === undefined && body.pollNotificationEnabled === undefined) {
    return NextResponse.json(
      { error: "Mindestens ein Feld muss aktualisiert werden" },
      { status: 400 }
    );
  }

  const validation = validateReminderSettings(body.eventReminderEnabled, body.eventReminderDaysBefore);
  if (!validation.isValid) {
    logValidationFailure(ROUTE, "PUT", validation.errors, { userId: user.id });
    throw new ValidationError(validation.errors);
  }

  if (body.pollNotificationEnabled !== undefined && typeof body.pollNotificationEnabled !== "boolean") {
    return NextResponse.json({ error: "Umfrage-Benachrichtigung muss true oder false sein" }, { status: 400 });
  }

  const updateData: {
    eventReminderEnabled?: boolean;
    eventReminderDaysBefore?: number;
    pollNotificationEnabled?: boolean;
  } = {};

  if (body.eventReminderEnabled !== undefined) {
    updateData.eventReminderEnabled = body.eventReminderEnabled;
  }
  if (body.eventReminderDaysBefore !== undefined) {
    updateData.eventReminderDaysBefore = body.eventReminderDaysBefore;
  }
  if (body.pollNotificationEnabled !== undefined) {
    updateData.pollNotificationEnabled = body.pollNotificationEnabled;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      eventReminderEnabled: true,
      eventReminderDaysBefore: true,
      pollNotificationEnabled: true,
    },
  });

  logInfo("notification_settings_updated", "Notification settings updated", {
    userId: user.id,
    eventReminderEnabled: updated.eventReminderEnabled,
    eventReminderDaysBefore: updated.eventReminderDaysBefore,
    pollNotificationEnabled: updated.pollNotificationEnabled,
  });

  return NextResponse.json(updated);
}, { route: ROUTE, method: "PUT" });

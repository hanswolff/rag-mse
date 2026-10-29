import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNoCacheHeaders } from "@/lib/api-error-handler";
import { recordSuccessfulTokenUsageWithPolicy, withTokenRateLimit } from "@/lib/api-utils";
import { hashNotificationToken } from "@/lib/reminders/notifications";
import { Permissions } from "@/lib/permissions";
import { maskToken } from "@/lib/logger";

const ROUTE = "/api/notifications/unsubscribe/[token]";

export const POST = withTokenRateLimit({
  route: ROUTE,
  method: "POST",
  action: "notification_unsubscribe_rate_limited",
  hashToken: hashNotificationToken,
  requireCsrf: true,
  invalidTokenMessage: "Ungültiger Link",
}, async (_request: NextRequest, { token, tokenHash, clientIp }) => {
  const dispatch = await prisma.eventReminderDispatch.findUnique({
    where: {
      unsubscribeTokenHash: tokenHash,
    },
    select: {
      userId: true,
      unsubscribeTokenExpiresAt: true,
      user: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!dispatch) {
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status: 404, headers: getNoCacheHeaders() }
    );
  }

  if (dispatch.unsubscribeTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Link ist abgelaufen" }, { status: 410, headers: getNoCacheHeaders() });
  }

  if (!Permissions.canManageOwnNotifications(dispatch.user.role)) {
    return NextResponse.json(
      { error: "Link ist ungültig oder abgelaufen" },
      { status: 403, headers: getNoCacheHeaders() }
    );
  }

  await prisma.user.update({
    where: { id: dispatch.userId },
    data: { eventReminderEnabled: false },
  });

  await recordSuccessfulTokenUsageWithPolicy(
    ROUTE,
    "POST",
    tokenHash,
    clientIp,
    maskToken(token)
  );

  return NextResponse.json({ success: true }, { headers: getNoCacheHeaders() });
});

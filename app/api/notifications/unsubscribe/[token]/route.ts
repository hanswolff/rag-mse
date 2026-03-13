import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  getNoCacheHeaders,
  handleRateLimitBlocked,
  validateCsrfHeaders,
  withApiErrorHandling,
  checkTokenRateLimitWithPolicy,
  recordSuccessfulTokenUsageWithPolicy,
} from "@/lib/api-utils";
import { hashNotificationToken } from "@/lib/notifications";
import { Permissions } from "@/lib/permissions";
import { maskToken } from "@/lib/logger";

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/notifications/unsubscribe/[token]">
) => {
  validateCsrfHeaders(request);

  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const tokenHash = hashNotificationToken(token);
  const rateLimitResult = await checkTokenRateLimitWithPolicy(
    "/api/notifications/unsubscribe/[token]",
    "POST",
    clientIp,
    tokenHash,
    maskToken(token)
  );

  if (!rateLimitResult.allowed) {
    return handleRateLimitBlocked(
      "notification_unsubscribe_rate_limited",
      "/api/notifications/unsubscribe/[token]",
      tokenHash,
      clientIp,
      rateLimitResult.blockedUntil,
      rateLimitResult.attemptCount
    );
  }

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
    "/api/notifications/unsubscribe/[token]",
    "POST",
    tokenHash,
    clientIp,
    maskToken(token)
  );

  return NextResponse.json({ success: true }, { headers: getNoCacheHeaders() });
}, { route: "/api/notifications/unsubscribe/[token]", method: "POST" });

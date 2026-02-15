import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkTokenRateLimit, recordSuccessfulTokenUsage } from "@/lib/rate-limiter";
import { getClientIp, getNoCacheHeaders, handleRateLimitBlocked, withApiErrorHandling } from "@/lib/api-utils";
import { hashNotificationToken } from "@/lib/notifications";

export const POST = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/notifications/unsubscribe/[token]">
) => {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Ungültiger Link" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const tokenHash = hashNotificationToken(token);
  const rateLimitResult = await checkTokenRateLimit(clientIp, tokenHash);

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

  await prisma.user.update({
    where: { id: dispatch.userId },
    data: { eventReminderEnabled: false },
  });

  await recordSuccessfulTokenUsage(tokenHash, clientIp);

  return NextResponse.json({ success: true }, { headers: getNoCacheHeaders() });
}, { route: "/api/notifications/unsubscribe/[token]", method: "POST" });

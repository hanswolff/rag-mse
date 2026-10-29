import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { sendMissingPollNotifications } from "@/lib/poll-publish";
import { logResourceNotFound } from "@/lib/logger";
import { logAdminAction } from "@/lib/audit-log";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await context.params;

  const result = await sendMissingPollNotifications(id);

  if (result.status === "not_found") {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]/notifications", "POST");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (result.status === "not_live") {
    return NextResponse.json(
      { error: "Benachrichtigungen können nur für aktive Umfragen nachgesendet werden" },
      { status: 409 }
    );
  }

  logAdminAction("poll_notifications_resend", user, {
    pollId: id,
    memberCount: result.queuedCount,
  });

  return NextResponse.json({ queuedCount: result.queuedCount });
}, { route: "/api/admin/polls/[id]/notifications", method: "POST" });

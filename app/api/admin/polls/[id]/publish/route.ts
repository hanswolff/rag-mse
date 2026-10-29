import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { publishPoll } from "@/lib/poll-publish";
import { logError, logInfo, logResourceNotFound } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await context.params;

  const result = await publishPoll(id);

  if (result.status === "not_found") {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]/publish", "POST");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (result.status === "not_draft") {
    return NextResponse.json(
      { error: "Nur Umfragen im Entwurfsstatus können veröffentlicht werden" },
      { status: 409 }
    );
  }

  if (result.status === "too_few_options") {
    return NextResponse.json(
      { error: "Zum Veröffentlichen sind mindestens 2 Optionen erforderlich" },
      { status: 400 }
    );
  }

  if (result.status === "notifications_incomplete") {
    logError("poll_notifications_incomplete", "Poll published but notifications could not all be queued", {
      pollId: id,
      userId: user.id,
      error: result.error instanceof Error ? result.error.message : String(result.error),
    });
    return NextResponse.json(
      {
        error:
          "Die Umfrage wurde veröffentlicht, aber nicht alle Benachrichtigungen konnten eingereiht werden. Bitte „Benachrichtigungen nachsenden“ verwenden.",
      },
      { status: 500 }
    );
  }

  logInfo("poll_published", "Poll published", {
    pollId: id,
    userId: user.id,
    shortCode: result.shortCode,
  });
  logInfo("poll_notifications_queued", "Poll notifications queued", {
    pollId: id,
    memberCount: result.queuedCount,
  });

  const updated = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json({ ...updated, pollUrl: result.pollUrl });
}, { route: "/api/admin/polls/[id]/publish", method: "POST" });

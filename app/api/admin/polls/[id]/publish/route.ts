import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logError, logResourceNotFound } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://rag-mse.de";

export const POST = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: { select: { id: true } },
    },
  });

  if (!poll) {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]/publish", "POST");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (poll.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Nur Umfragen im Entwurfsstatus können veröffentlicht werden" },
      { status: 409 }
    );
  }

  if (poll.options.length < 2) {
    return NextResponse.json(
      { error: "Mindestens 2 Optionen sind erforderlich zum Veröffentlichen" },
      { status: 400 }
    );
  }

  const updated = await prisma.poll.update({
    where: { id },
    data: {
      status: "LIVE",
      shortCode: poll.id,
    },
    include: {
      options: { orderBy: { position: "asc" } },
    },
  });

  logInfo("poll_published", "Poll published", {
    pollId: id,
    userId: user.id,
    shortCode: updated.shortCode,
  });

  const pollUrl = `${siteUrl}/u/${updated.shortCode}`;

  try {
    const members = await prisma.user.findMany({
      where: {
        pollNotificationEnabled: true,
      },
      select: { id: true, name: true, email: true },
    });

    const descriptionText = poll.description
      ? poll.description
      : "";

    for (const member of members) {
      try {
        await sendTemplateEmail({
          template: "umfrage-benachrichtigung",
          variables: {
            pollTitle: poll.title,
            pollDescription: descriptionText,
            pollUrl,
            userName: member.name || "Mitglied",
          },
          to: [member.email],
        });

        await prisma.pollNotificationDispatch.create({
          data: {
            pollId: id,
            userId: member.id,
            queuedAt: new Date(),
          },
        });
      } catch (emailError) {
        logError("poll_notification_failed", "Failed to queue poll notification", {
          pollId: id,
          userId: member.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    logInfo("poll_notifications_queued", "Poll notifications queued", {
      pollId: id,
      memberCount: members.length,
    });
  } catch (notifyError) {
    logError("poll_notification_batch_failed", "Failed to process poll notifications", {
      pollId: id,
      error: notifyError instanceof Error ? notifyError.message : String(notifyError),
    });
  }

  return NextResponse.json({ ...updated, shortCode: updated.shortCode, pollUrl });
}, { route: "/api/admin/polls/[id]/publish", method: "POST" });

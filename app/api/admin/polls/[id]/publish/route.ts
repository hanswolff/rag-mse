import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logInfo, logResourceNotFound } from "@/lib/logger";

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

  const members = await prisma.user.findMany({
    where: {
      pollNotificationEnabled: true,
      activatedAt: { not: null },
    },
    select: { id: true, name: true, email: true },
  });

  const pollUrl = `${siteUrl}/u/${poll.id}`;
  const descriptionText = poll.description ? poll.description : "";

  // Statuswechsel und Benachrichtigungen in einer Transaktion:
  // - updateMany mit DRAFT-Guard verhindert Doppelveröffentlichung (Race/Doppelklick)
  // - Dispatch-Eintrag vor dem E-Mail-Insert dedupliziert je Mitglied
  // - Schlägt der Batch fehl, rollt auch der Statuswechsel zurück und
  //   die Veröffentlichung bleibt wiederholbar
  let queuedCount = 0;
  const flipped = await prisma.$transaction(async (tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => {
    const updateResult = await tx.poll.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "LIVE", shortCode: poll.id },
    });

    if (updateResult.count === 0) {
      return false;
    }

    for (const member of members) {
      try {
        await tx.pollNotificationDispatch.create({
          data: {
            pollId: id,
            userId: member.id,
            queuedAt: new Date(),
          },
        });
      } catch (dispatchError) {
        if (isUniqueConstraintError(dispatchError)) {
          continue;
        }
        throw dispatchError;
      }

      await sendTemplateEmail({
        template: "umfrage-benachrichtigung",
        variables: {
          pollTitle: poll.title,
          pollDescription: descriptionText,
          pollUrl,
          userName: member.name || "Mitglied",
        },
        to: [member.email],
      }, tx);
      queuedCount++;
    }

    return true;
    // Standard-Timeout von 5 s reicht bei vielen Mitgliedern nicht: pro Mitglied
    // werden Template gerendert und zwei Zeilen geschrieben
  }, { timeout: 30_000 });

  if (!flipped) {
    return NextResponse.json(
      { error: "Nur Umfragen im Entwurfsstatus können veröffentlicht werden" },
      { status: 409 }
    );
  }

  logInfo("poll_published", "Poll published", {
    pollId: id,
    userId: user.id,
    shortCode: poll.id,
  });
  logInfo("poll_notifications_queued", "Poll notifications queued", {
    pollId: id,
    memberCount: queuedCount,
  });

  const updated = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json({ ...updated, pollUrl });
}, { route: "/api/admin/polls/[id]/publish", method: "POST" });

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

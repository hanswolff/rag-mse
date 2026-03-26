import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logResourceNotFound } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!poll) {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]/reopen", "POST");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (poll.status !== "CLOSED") {
    return NextResponse.json(
      { error: "Nur geschlossene Umfragen können wieder geöffnet werden" },
      { status: 409 }
    );
  }

  const updated = await prisma.poll.update({
    where: { id },
    data: { status: "LIVE" },
    include: {
      options: { orderBy: { position: "asc" } },
    },
  });

  logInfo("poll_reopened", "Poll reopened", { pollId: id, userId: user.id });

  return NextResponse.json(updated);
}, { route: "/api/admin/polls/[id]/reopen", method: "POST" });

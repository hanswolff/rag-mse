import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { canAccessAdminArea } from "@/lib/role-utils";
import { redactInvisibleEvent } from "@/lib/event-visibility";
import { withApiErrorHandling, getAuthNoCacheHeaders } from "@/lib/api-error-handler";
import { logResourceNotFound } from "@/lib/logger";

const ROUTE = "/api/polls/[id]";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: NextRequest, context: RouteParams) => {
  const user = await requireMember();
  const { id } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: {
        orderBy: { position: "asc" },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
      votes: {
        where: { userId: user.id },
        select: { optionId: true },
      },
      event: {
        select: { id: true, date: true, timeFrom: true, timeTo: true, location: true, description: true, visibility: true, createdById: true },
      },
    },
  });

  if (!poll) {
    logResourceNotFound("poll", id, ROUTE, "GET");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (poll.status === "DRAFT") {
    logResourceNotFound("poll", id, ROUTE, "GET");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  const { votes, event, ...rest } = poll;

  return NextResponse.json({
    ...rest,
    event: redactInvisibleEvent(event, { userId: user.id, canSeeAll: canAccessAdminArea(user) }),
    userVoteOptionIds: votes.map((v) => v.optionId),
  }, { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "GET" });

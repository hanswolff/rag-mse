import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateCsrfHeaders,
  getAuthNoCacheHeaders,
} from "@/lib/api-utils";
import { validateVoteRequest } from "@/lib/poll-validation";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

interface VoteRequestBody {
  optionIds: string[];
}

export const POST = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireMember();
  const { id: pollId } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { select: { id: true } },
    },
  });

  if (!poll) {
    logResourceNotFound("poll", pollId, "/api/polls/[id]/vote", "POST");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (poll.status !== "LIVE") {
    return NextResponse.json({ error: "Abstimmung ist nur bei aktiven Umfragen möglich" }, { status: 409 });
  }

  const body = await parseJsonBody<VoteRequestBody>(request);
  const validation = validateVoteRequest(body.optionIds, poll.multipleChoice);
  if (!validation.isValid) {
    logValidationFailure("/api/polls/[id]/vote", "POST", validation.errors, { userId: user.id, pollId });
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const validOptionIds = new Set(poll.options.map((o) => o.id));
  for (const optId of body.optionIds) {
    if (!validOptionIds.has(optId)) {
      return NextResponse.json({ error: "Ungültige Options-ID" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.pollVote.deleteMany({
      where: { pollId, userId: user.id },
    }),
    prisma.pollVote.createMany({
      data: body.optionIds.map((optionId) => ({
        pollId,
        optionId,
        userId: user.id,
      })),
    }),
  ]);

  logInfo("poll_vote_cast", "Poll vote cast", {
    pollId,
    userId: user.id,
    optionCount: body.optionIds.length,
  });

  return NextResponse.json({ success: true, optionIds: body.optionIds }, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/polls/[id]/vote", method: "POST" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireMember();
  const { id: pollId } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { id: true, status: true },
  });

  if (!poll) {
    logResourceNotFound("poll", pollId, "/api/polls/[id]/vote", "DELETE");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (poll.status !== "LIVE") {
    return NextResponse.json({ error: "Stimmen können nur bei aktiven Umfragen zurückgezogen werden" }, { status: 409 });
  }

  await prisma.pollVote.deleteMany({
    where: { pollId, userId: user.id },
  });

  logInfo("poll_vote_withdrawn", "Poll vote withdrawn", { pollId, userId: user.id });

  return NextResponse.json({ success: true }, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/polls/[id]/vote", method: "DELETE" });

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { withApiErrorHandling, getAuthNoCacheHeaders } from "@/lib/api-utils";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const user = await requireMember();

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"), 20, 50);
  const skip = (page - 1) * limit;
  const type = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const eventId = searchParams.get("eventId");

  const validStatuses = ["LIVE", "CLOSED"];
  let statusFilter: string | { in: string[] } = "LIVE";
  if (statusParam) {
    const requested = statusParam.split(",").filter((s) => validStatuses.includes(s));
    if (requested.length === 1) {
      statusFilter = requested[0];
    } else if (requested.length > 1) {
      statusFilter = { in: requested };
    }
  }

  const where: Record<string, unknown> = { status: statusFilter };
  if (type === "SONSTIGES" || type === "TERMIN") {
    where.type = type;
  }
  if (eventId) {
    where.eventId = eventId;
  }

  const createdAtFilter: Record<string, Date> = {};
  if (before) {
    const d = new Date(before);
    if (!isNaN(d.getTime())) createdAtFilter.lt = d;
  }
  if (after) {
    const d = new Date(after);
    if (!isNaN(d.getTime())) createdAtFilter.gte = d;
  }
  if (Object.keys(createdAtFilter).length > 0) {
    where.createdAt = createdAtFilter;
  }

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
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
          select: { id: true, date: true, timeFrom: true, timeTo: true, location: true, description: true },
        },
      },
    }),
    prisma.poll.count({ where }),
  ]);

  const pollsWithUserVotes = polls.map(({ votes, ...poll }) => ({
    ...poll,
    userVoteOptionIds: votes.map((v) => v.optionId),
  }));

  return NextResponse.json({
    polls: pollsWithUserVotes,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  }, { headers: getAuthNoCacheHeaders() });
}, { route: "/api/polls", method: "GET" });

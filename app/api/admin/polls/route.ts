import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateCreatePollRequest, type CreatePollRequest } from "@/lib/poll-validation";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateCsrfHeaders,
} from "@/lib/api-utils";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";
import { generateUniquePollId } from "@/lib/poll-utils";

const POLL_ID_RETRY_LIMIT = 3;

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin("read");

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"), 20);
  const skip = (page - 1) * limit;

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        options: {
          orderBy: { position: "asc" },
        },
        _count: {
          select: { votes: true },
        },
        event: {
          select: { id: true, date: true, description: true },
        },
      },
    }),
    prisma.poll.count(),
  ]);

  return NextResponse.json({
    polls,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}, { route: "/api/admin/polls", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const body = await parseJsonBody<CreatePollRequest>(request);

  const validation = validateCreatePollRequest(body);
  if (!validation.isValid) {
    logValidationFailure("/api/admin/polls", "POST", validation.errors, { userId: user.id });
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  if (body.type === "TERMIN" && body.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: body.eventId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
    }
  }

  let poll;
  for (let attempt = 0; attempt < POLL_ID_RETRY_LIMIT; attempt++) {
    const pollId = await generateUniquePollId();
    try {
      poll = await prisma.poll.create({
        data: {
          id: pollId,
          title: body.title.trim(),
          description: body.description?.trim() || null,
          type: body.type as "TERMIN" | "SONSTIGES",
          multipleChoice: body.multipleChoice ?? false,
          eventId: body.type === "TERMIN" ? body.eventId : null,
          createdById: user.id,
          options: {
            create: body.options.map((opt, index) => ({
              text: opt.text.trim(),
              position: opt.position ?? index,
            })),
          },
        },
        include: {
          options: { orderBy: { position: "asc" } },
        },
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < POLL_ID_RETRY_LIMIT - 1
      ) {
        continue;
      }
      throw error;
    }
  }

  if (!poll) {
    return NextResponse.json({ error: "Umfrage-ID konnte nicht erzeugt werden" }, { status: 500 });
  }

  logInfo("poll_created", "Poll created", { pollId: poll.id, userId: user.id, type: body.type });

  return NextResponse.json(poll, { status: 201 });
}, { route: "/api/admin/polls", method: "POST" });

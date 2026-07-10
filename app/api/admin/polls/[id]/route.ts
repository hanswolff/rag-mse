import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateUpdatePollRequest, type UpdatePollRequest } from "@/lib/poll-validation";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateCsrfHeaders,
} from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";

type RouteParams = { params: Promise<{ id: string }> };

class PollNotDraftError extends Error {
  constructor() {
    super("Poll is not in DRAFT status");
    this.name = "PollNotDraftError";
  }
}

export const GET = withApiErrorHandling(async (_request: NextRequest, context: RouteParams) => {
  await requireAdmin("read");
  const { id } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" }, include: { _count: { select: { votes: true } } } },
      _count: { select: { votes: true } },
      event: { select: { id: true, date: true, description: true } },
      votes: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          option: { select: { id: true, text: true } },
        },
      },
    },
  });

  if (!poll) {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]", "GET");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(poll);
}, { route: "/api/admin/polls/[id]", method: "GET" });

export const PATCH = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!poll) {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]", "PATCH");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  if (poll.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Nur Umfragen im Entwurfsstatus können bearbeitet werden" },
      { status: 409 }
    );
  }

  const body = await parseJsonBody<UpdatePollRequest>(request);
  const validation = validateUpdatePollRequest(body);
  if (!validation.isValid) {
    logValidationFailure("/api/admin/polls/[id]", "PATCH", validation.errors, { userId: user.id });
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.multipleChoice !== undefined) updateData.multipleChoice = body.multipleChoice;

  // Status-Prüfung und Options-Austausch in EINER Transaktion: der Vorab-Check oben
  // ist nur für die schnelle Fehlermeldung — ein gleichzeitiges Publish zwischen
  // Check und Update darf Optionen/Stimmen einer LIVE-Umfrage nicht löschen.
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const current = await tx.poll.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!current || current.status !== "DRAFT") {
        throw new PollNotDraftError();
      }

      if (body.options !== undefined) {
        await tx.pollOption.deleteMany({ where: { pollId: id } });
        await tx.pollOption.createMany({
          data: body.options.map((opt, index) => ({
            pollId: id,
            text: opt.text.trim(),
            position: opt.position ?? index,
          })),
        });
      }

      return tx.poll.update({
        where: { id },
        data: updateData,
        include: {
          options: { orderBy: { position: "asc" } },
        },
      });
    });
  } catch (error) {
    if (error instanceof PollNotDraftError) {
      return NextResponse.json(
        { error: "Nur Umfragen im Entwurfsstatus können bearbeitet werden" },
        { status: 409 }
      );
    }
    throw error;
  }

  logInfo("poll_updated", "Poll updated", { pollId: id, userId: user.id });

  return NextResponse.json(updated);
}, { route: "/api/admin/polls/[id]", method: "PATCH" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, context: RouteParams) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");
  const { id } = await context.params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!poll) {
    logResourceNotFound("poll", id, "/api/admin/polls/[id]", "DELETE");
    return NextResponse.json({ error: "Umfrage nicht gefunden" }, { status: 404 });
  }

  await prisma.poll.delete({ where: { id } });

  logInfo("poll_deleted", "Poll deleted", { pollId: id, userId: user.id });

  return NextResponse.json({ success: true });
}, { route: "/api/admin/polls/[id]", method: "DELETE" });

import { NextRequest, NextResponse } from "next/server";
import { VoteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateName } from "@/lib/user-validation";
import { validateVote } from "@/lib/event-validation";
import { parseAndValidateBody } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { suppressCatchUpReminder } from "@/lib/reminders/event-reminder-worker";

const ROUTE = "/api/admin/events/[id]/registrations";

type RegistrationType = "member" | "guest";

type RegistrationRequest = {
  type?: RegistrationType;
  userId?: string;
  name?: string;
  vote?: string;
};

const registrationSchema = {
  type: { type: "string" as const },
  userId: { type: "string" as const, optional: true },
  name: { type: "string" as const, optional: true },
  vote: { type: "string" as const, optional: true },
} as const;

function isRegistrationType(value: string): value is RegistrationType {
  return value === "member" || value === "guest";
}

async function ensureEventExists(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    logResourceNotFound("event", eventId, ROUTE, "*", {});
    return false;
  }
  return true;
}

export const GET = withApiErrorHandling(async (_request: NextRequest, ctx: RouteContext<"/api/admin/events/[id]/registrations">) => {
  await requireAdmin("read");

  const { id: eventId } = await ctx.params;

  const eventExists = await ensureEventExists(eventId);
  if (!eventExists) {
    logResourceNotFound("event", eventId, ROUTE, "GET");
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  const [users, guests] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        votes: {
          where: { eventId },
          select: { vote: true },
          take: 1,
        },
      },
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
    }),
    prisma.guestRegistration.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        vote: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return NextResponse.json({
    members: users.map((user) => ({
      userId: user.id,
      name: user.name?.trim() || user.email,
      vote: user.votes[0]?.vote ?? null,
    })),
    guests,
  });
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/events/[id]/registrations">) => {
  validateCsrfHeaders(request);

  await requireAdmin("write");

  const { id: eventId } = await ctx.params;
  const body = await parseAndValidateBody<RegistrationRequest>(request, registrationSchema, { route: ROUTE, method: "POST" });

  if (!body.type || !isRegistrationType(body.type)) {
    return NextResponse.json({ error: "Ungültiger Anmeldungstyp" }, { status: 400 });
  }

  if (!(await ensureEventExists(eventId))) {
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  if (!body.vote || !validateVote(body.vote)) {
    logValidationFailure(
      ROUTE,
      "POST",
      "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT",
      { eventId }
    );
    return NextResponse.json(
      { error: "Ungültige Teilnahmeanmeldung. Erlaubt sind: JA, NEIN, VIELLEICHT" },
      { status: 400 }
    );
  }

  if (body.type === "member") {
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId ist erforderlich" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      logResourceNotFound("user", userId, ROUTE, "POST", { eventId });
      return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
    }

    const savedVote = await prisma.vote.upsert({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      create: {
        userId,
        eventId,
        vote: body.vote as VoteType,
      },
      update: {
        vote: body.vote as VoteType,
      },
      select: {
        vote: true,
      },
    });

    logInfo("admin_member_registration_saved", "Admin updated member registration", {
      eventId,
      userId,
      vote: body.vote,
    });

    return NextResponse.json({
      type: "member",
      registration: {
        userId: user.id,
        name: user.name?.trim() || user.email,
        vote: savedVote.vote,
      },
    });
  }

  const guestName = body.name?.trim();
  if (!guestName) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const nameValidation = validateName(guestName);
  if (!nameValidation.isValid) {
    return NextResponse.json({ error: nameValidation.error || "Ungültiger Name" }, { status: 400 });
  }

  const savedGuest = await prisma.guestRegistration.upsert({
    where: {
      eventId_name: {
        eventId,
        name: guestName,
      },
    },
    create: {
      eventId,
      name: guestName,
      vote: body.vote as VoteType,
    },
    update: {
      vote: body.vote as VoteType,
    },
    select: {
      id: true,
      name: true,
      vote: true,
    },
  });

  logInfo("admin_guest_registration_saved", "Admin updated guest registration", {
    eventId,
    name: guestName,
    vote: body.vote,
  });

  return NextResponse.json({
    type: "guest",
    registration: savedGuest,
  });
}, { route: ROUTE, method: "POST" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/events/[id]/registrations">) => {
  validateCsrfHeaders(request);

  await requireAdmin("write");

  const { id: eventId } = await ctx.params;
  const body = await parseAndValidateBody<RegistrationRequest>(request, registrationSchema, { route: ROUTE, method: "DELETE" });

  if (!body.type || !isRegistrationType(body.type)) {
    return NextResponse.json({ error: "Ungültiger Anmeldungstyp" }, { status: 400 });
  }

  if (!(await ensureEventExists(eventId))) {
    return NextResponse.json({ error: "Termin nicht gefunden" }, { status: 404 });
  }

  if (body.type === "member") {
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId ist erforderlich" }, { status: 400 });
    }

    const result = await prisma.vote.deleteMany({
      where: {
        eventId,
        userId,
      },
    });

    if (result.count === 0) {
      logResourceNotFound("vote", `${userId}-${eventId}`, ROUTE, "DELETE", {
        type: "member",
      });
      return NextResponse.json({ error: "Teilnahmeanmeldung nicht gefunden" }, { status: 404 });
    }

    await suppressCatchUpReminder(userId, eventId);

    logInfo("admin_member_registration_deleted", "Admin removed member registration", {
      eventId,
      userId,
    });

    return NextResponse.json({ success: true });
  }

  const guestName = body.name?.trim();
  if (!guestName) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const result = await prisma.guestRegistration.deleteMany({
    where: {
      eventId,
      name: guestName,
    },
  });

  if (result.count === 0) {
    logResourceNotFound("guest_registration", `${eventId}-${guestName}`, ROUTE, "DELETE", {
      type: "guest",
    });
    return NextResponse.json({ error: "Gastanmeldung nicht gefunden" }, { status: 404 });
  }

  logInfo("admin_guest_registration_deleted", "Admin removed guest registration", {
    eventId,
    name: guestName,
  });

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

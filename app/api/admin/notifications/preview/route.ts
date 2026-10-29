import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ForbiddenError } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { renderEmailTemplate } from "@/lib/email-templates";
import { Permissions } from "@/lib/permissions";
import { getAppUrl } from "@/lib/site-config";
import { normalizeAppUrl } from "@/lib/reminders/notification-links";
import {
  EVENT_REMINDER_EMAIL_TEMPLATE,
  buildEventReminderEmailVariables,
} from "@/lib/reminders/notifications";

const POLL_NOTIFICATION_EMAIL_TEMPLATE = "umfrage-benachrichtigung";

// Persönliche Token-Links werden in der Vorschau nie ausgegeben, sondern
// durch diese Platzhaltertexte ersetzt.
const RSVP_LINK_PLACEHOLDER = "[Link enthält persönlichen Anmelde-Token]";
const UNSUBSCRIBE_LINK_PLACEHOLDER = "[Link enthält persönlichen Abmelde-Token]";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth();
  if (!Permissions.canReadNotificationsAdmin(user)) {
    throw new ForbiddenError("Keine Berechtigung");
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Benachrichtigungs-ID fehlt" }, { status: 400 });
  }

  if (searchParams.get("type") === "poll") {
    const dispatch = await prisma.pollNotificationDispatch.findUnique({
      where: { id },
      select: {
        user: { select: { name: true } },
        poll: { select: { id: true, title: true, description: true } },
      },
    });

    if (!dispatch) {
      return NextResponse.json({ error: "Benachrichtigung nicht gefunden" }, { status: 404 });
    }

    const rendered = await renderEmailTemplate(POLL_NOTIFICATION_EMAIL_TEMPLATE, {
      pollTitle: dispatch.poll.title,
      pollDescription: dispatch.poll.description || "",
      pollUrl: `${normalizeAppUrl(getAppUrl())}/u/${dispatch.poll.id}`,
      userName: dispatch.user.name || "Mitglied",
    });

    return NextResponse.json(rendered);
  }

  const dispatch = await prisma.eventReminderDispatch.findUnique({
    where: { id },
    select: {
      daysBefore: true,
      event: {
        select: {
          date: true,
          timeFrom: true,
          timeTo: true,
          location: true,
          title: true,
          type: true,
        },
      },
    },
  });

  if (!dispatch) {
    return NextResponse.json({ error: "Benachrichtigung nicht gefunden" }, { status: 404 });
  }

  const rendered = await renderEmailTemplate(
    EVENT_REMINDER_EMAIL_TEMPLATE,
    buildEventReminderEmailVariables(dispatch.event, {
      daysBefore: dispatch.daysBefore,
      rsvpUrl: RSVP_LINK_PLACEHOLDER,
      unsubscribeUrl: UNSUBSCRIBE_LINK_PLACEHOLDER,
    }),
  );

  return NextResponse.json(rendered);
}, { route: "/api/admin/notifications/preview", method: "GET" });

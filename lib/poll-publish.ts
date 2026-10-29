import type { Poll, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { createTemplateEmailRenderer, enqueueRenderedEmail } from "./email-sender";
import { normalizeAppUrl } from "./reminders/notification-links";
import { getAppUrl } from "./site-config";

// Kleine Blöcke halten jede Einreihungs-Transaktion kurz; gerendert wird
// vorher, damit die Transaktion nur DB-Zugriffe enthält (ADR 0012).
const EMAIL_ENQUEUE_BATCH_SIZE = 20;

type PollRecipient = { id: string; name: string | null; email: string };

export type PublishPollResult =
  | { status: "not_found" }
  | { status: "not_draft" }
  | { status: "too_few_options" }
  | { status: "published"; pollUrl: string; shortCode: string; queuedCount: number }
  | { status: "notifications_incomplete"; error: unknown };

export type SendMissingPollNotificationsResult =
  | { status: "not_found" }
  | { status: "not_live" }
  | { status: "sent"; queuedCount: number };

function buildPollUrl(pollId: string): string {
  return `${normalizeAppUrl(getAppUrl())}/u/${pollId}`;
}

// Umfrage-Benachrichtigung und E-Mail entstehen je Block in derselben
// Transaktion: Scheitert ein Block, fehlen genau dessen Mitglieder — und
// ein erneuter Aufruf benachrichtigt nur sie.
async function queueMissingPollNotifications(
  poll: Pick<Poll, "id" | "title" | "description">
): Promise<number> {
  const render = await createTemplateEmailRenderer("umfrage-benachrichtigung");
  const pollUrl = buildPollUrl(poll.id);

  const [members, existingDispatches] = await Promise.all([
    prisma.user.findMany({
      where: {
        pollNotificationEnabled: true,
        activatedAt: { not: null },
      },
      select: { id: true, name: true, email: true },
    }),
    prisma.pollNotificationDispatch.findMany({
      where: { pollId: poll.id },
      select: { userId: true },
    }),
  ]);
  const alreadyNotified = new Set(existingDispatches.map((dispatch) => dispatch.userId));
  const pending: PollRecipient[] = members.filter((member) => !alreadyNotified.has(member.id));

  let queuedCount = 0;

  for (let offset = 0; offset < pending.length; offset += EMAIL_ENQUEUE_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + EMAIL_ENQUEUE_BATCH_SIZE).map((member) => ({
      member,
      email: render({
        variables: {
          pollTitle: poll.title,
          pollDescription: poll.description ?? "",
          pollUrl,
          userName: member.name || "Mitglied",
        },
        to: [member.email],
      }),
    }));

    queuedCount += await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const concurrent = await tx.pollNotificationDispatch.findMany({
        where: { pollId: poll.id, userId: { in: batch.map(({ member }) => member.id) } },
        select: { userId: true },
      });
      const skip = new Set(concurrent.map((dispatch) => dispatch.userId));
      const toQueue = batch.filter(({ member }) => !skip.has(member.id));
      const now = new Date();

      for (const { member, email } of toQueue) {
        await tx.pollNotificationDispatch.create({
          data: { pollId: poll.id, userId: member.id, queuedAt: now, sentAt: now },
        });
        await enqueueRenderedEmail(email, tx);
      }

      return toQueue.length;
    });
  }

  return queuedCount;
}

export async function publishPoll(pollId: string): Promise<PublishPollResult> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { select: { id: true } },
    },
  });

  if (!poll) {
    return { status: "not_found" };
  }

  if (poll.status !== "DRAFT") {
    return { status: "not_draft" };
  }

  if (poll.options.length < 2) {
    return { status: "too_few_options" };
  }

  const updateResult = await prisma.poll.updateMany({
    where: { id: pollId, status: "DRAFT" },
    data: { status: "LIVE", shortCode: poll.id },
  });

  if (updateResult.count === 0) {
    return { status: "not_draft" };
  }

  // Die Umfrage ist ab hier LIVE; ein Fehler beim Einreihen wird über
  // „Benachrichtigungen nachsenden“ behoben, nicht über erneutes Veröffentlichen.
  try {
    const queuedCount = await queueMissingPollNotifications(poll);
    return { status: "published", pollUrl: buildPollUrl(poll.id), shortCode: poll.id, queuedCount };
  } catch (error) {
    return { status: "notifications_incomplete", error };
  }
}

// Nachsenden nach einer abgebrochenen Veröffentlichung: benachrichtigt alle
// Mitglieder mit aktivierter Umfrage-Benachrichtigung, die noch keine haben.
export async function sendMissingPollNotifications(
  pollId: string
): Promise<SendMissingPollNotificationsResult> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { id: true, title: true, description: true, status: true },
  });

  if (!poll) {
    return { status: "not_found" };
  }

  if (poll.status !== "LIVE") {
    return { status: "not_live" };
  }

  return { status: "sent", queuedCount: await queueMissingPollNotifications(poll) };
}

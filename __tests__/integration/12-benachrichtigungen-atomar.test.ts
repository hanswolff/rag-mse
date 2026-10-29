import { OutgoingEmailStatus } from "@prisma/client";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { POST as publishPoll } from "@/app/api/admin/polls/[id]/publish/route";
import { POST as sendMissingNotifications } from "@/app/api/admin/polls/[id]/notifications/route";
import { processEventReminders } from "@/lib/reminders/event-reminder-worker";
import { EVENT_REMINDER_EMAIL_TEMPLATE } from "@/lib/reminders/notifications";
import { sendTemplateEmail } from "@/lib/email-sender";
import { processDueEmailOutboxBatch } from "@/lib/email/outbox-worker";
import { MAX_RETRY_WINDOW_MS } from "@/lib/email/types";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import { createAdmin, createAuditor, createEvent, createPoll, createUser } from "./helpers/factories";

// Systemgrenze: SMTP-Transport. DB-Fehler entstehen real über SQLite-Trigger.
jest.mock("nodemailer", () => {
  const sendMail = jest.fn();
  const transport = { sendMail, verify: jest.fn() };
  const createTransport = jest.fn(() => transport);
  return { __esModule: true, default: { createTransport }, createTransport };
});

const mockSendMail = (
  nodemailer as unknown as { createTransport: () => { sendMail: jest.Mock } }
).createTransport().sendMail;

const POLL_TEMPLATE = "umfrage-benachrichtigung";
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(() => {
  process.env.EMAIL_DEV_MODE = "false";
  process.env.SMTP_HOST = "smtp.integration.example";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "postausgang";
  process.env.SMTP_PASSWORD = "integration-geheim";
  process.env.SMTP_FROM = "noreply@example.com";
});

async function dropTrigger(name: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}"`);
}

function pollRequest(pollId: string, action: "publish" | "notifications") {
  const handler = action === "publish" ? publishPoll : sendMissingNotifications;
  return handler(
    apiRequest("POST", `/api/admin/polls/${pollId}/${action}`),
    routeContext({ id: pollId })
  );
}

describe("Umfrage-Veröffentlichung: Benachrichtigung und E-Mail je Block atomar", () => {
  afterEach(() => dropTrigger("fail_poll_block_2"));

  it("benachrichtigt nach Fehler in Block 2 per Nachsenden jedes Mitglied genau einmal", async () => {
    await prisma.user.updateMany({ data: { pollNotificationEnabled: false } });
    const admin = await createAdmin({ pollNotificationEnabled: false });
    const members = await Promise.all(Array.from({ length: 25 }, () => createUser()));
    const poll = await createPoll({ status: "DRAFT" });
    loginAs(admin);

    // Block 1 (20 E-Mails) gelingt, die erste E-Mail von Block 2 scheitert.
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "fail_poll_block_2" BEFORE INSERT ON "OutgoingEmail"
      WHEN NEW."template" = '${POLL_TEMPLATE}'
        AND (SELECT COUNT(*) FROM "OutgoingEmail" WHERE "template" = '${POLL_TEMPLATE}') >= 20
      BEGIN SELECT RAISE(ABORT, 'Testfehler Block 2'); END
    `);

    const publishResponse = await pollRequest(poll.id, "publish");
    expect(publishResponse.status).toBe(500);
    await expect(publishResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("Benachrichtigungen nachsenden"),
    });

    await expect(prisma.poll.findUniqueOrThrow({ where: { id: poll.id } })).resolves.toMatchObject({
      status: "LIVE",
    });
    const dispatchesAfterFailure = await prisma.pollNotificationDispatch.findMany({
      where: { pollId: poll.id },
      include: { user: { select: { email: true } } },
    });
    const emailsAfterFailure = await prisma.outgoingEmail.findMany({ where: { template: POLL_TEMPLATE } });
    expect(dispatchesAfterFailure).toHaveLength(20);
    expect(emailsAfterFailure.map((email) => email.toRecipients).sort()).toEqual(
      dispatchesAfterFailure.map((dispatch) => dispatch.user.email).sort()
    );

    expect((await pollRequest(poll.id, "publish")).status).toBe(409);

    await dropTrigger("fail_poll_block_2");
    const resendResponse = await pollRequest(poll.id, "notifications");
    expect(resendResponse.status).toBe(200);
    await expect(resendResponse.json()).resolves.toEqual({ queuedCount: 5 });

    const emails = await prisma.outgoingEmail.findMany({ where: { template: POLL_TEMPLATE } });
    expect(emails.map((email) => email.toRecipients).sort()).toEqual(
      members.map((member) => member.email).sort()
    );
    await expect(prisma.pollNotificationDispatch.count({ where: { pollId: poll.id } })).resolves.toBe(25);

    const secondResend = await pollRequest(poll.id, "notifications");
    await expect(secondResend.json()).resolves.toEqual({ queuedCount: 0 });
    await expect(prisma.outgoingEmail.count({ where: { template: POLL_TEMPLATE } })).resolves.toBe(25);
  });

  it("benachrichtigt nur aktivierte Mitglieder mit eingeschalteter Umfrage-Benachrichtigung", async () => {
    await prisma.user.updateMany({ data: { pollNotificationEnabled: false } });
    const admin = await createAdmin({ pollNotificationEnabled: false });
    const eligible = await createUser();
    await createUser({ pollNotificationEnabled: false });
    await createUser({ activatedAt: null });
    const poll = await createPoll({ status: "LIVE" });
    loginAs(admin);

    const response = await pollRequest(poll.id, "notifications");

    await expect(response.json()).resolves.toEqual({ queuedCount: 1 });
    const dispatches = await prisma.pollNotificationDispatch.findMany({ where: { pollId: poll.id } });
    expect(dispatches.map((dispatch) => dispatch.userId)).toEqual([eligible.id]);
    expect(dispatches[0].sentAt).not.toBeNull();
    await expect(
      prisma.outgoingEmail.count({ where: { template: POLL_TEMPLATE, toRecipients: eligible.email } })
    ).resolves.toBe(1);
  });

  it("verweigert Auditor und Mitglied das Nachsenden und prüft CSRF", async () => {
    const poll = await createPoll({ status: "LIVE" });

    for (const user of [await createAuditor(), await createUser()]) {
      loginAs(user);
      expect((await pollRequest(poll.id, "notifications")).status).toBe(403);
    }

    loginAs(await createAdmin());
    const previousAppUrl = process.env.APP_URL;
    process.env.APP_URL = "http://localhost:3000";
    try {
      const foreignOrigin = await sendMissingNotifications(
        apiRequest("POST", `/api/admin/polls/${poll.id}/notifications`, {
          headers: { "user-agent": "Mozilla/5.0", origin: "https://angreifer.example" },
        }),
        routeContext({ id: poll.id })
      );
      expect(foreignOrigin.status).toBe(403);
    } finally {
      process.env.APP_URL = previousAppUrl;
    }

    await expect(prisma.pollNotificationDispatch.count({ where: { pollId: poll.id } })).resolves.toBe(0);
  });

  it("sendet nur für Live-Umfragen nach", async () => {
    const admin = await createAdmin();
    const draft = await createPoll({ status: "DRAFT" });
    const closed = await createPoll({ status: "CLOSED" });
    loginAs(admin);

    expect((await pollRequest(draft.id, "notifications")).status).toBe(409);
    expect((await pollRequest(closed.id, "notifications")).status).toBe(409);
    expect((await pollRequest("gibtesnicht", "notifications")).status).toBe(404);
    await expect(
      prisma.pollNotificationDispatch.count({ where: { pollId: { in: [draft.id, closed.id] } } })
    ).resolves.toBe(0);
  });
});

describe("Termin-Erinnerung: Vermerk und E-Mail atomar", () => {
  afterEach(() => dropTrigger("fail_reminder_email"));

  it("hinterlässt bei gescheiterter Einreihung keinen Vermerk und holt die Erinnerung im nächsten Lauf nach", async () => {
    await prisma.user.updateMany({ data: { eventReminderEnabled: false } });
    const user = await createUser({ eventReminderDaysBefore: 7 });
    const eventDay = new Date();
    eventDay.setDate(eventDay.getDate() + 9);
    eventDay.setHours(0, 0, 0, 0);
    const event = await createEvent({ date: eventDay, timeFrom: "10:00" });
    const runAt = new Date(eventDay.getTime() + 10 * 60 * 60 * 1000 - 7 * DAY_MS);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "fail_reminder_email" BEFORE INSERT ON "OutgoingEmail"
      WHEN NEW."template" = '${EVENT_REMINDER_EMAIL_TEMPLATE}'
      BEGIN SELECT RAISE(ABORT, 'Testfehler Erinnerung'); END
    `);

    await expect(processEventReminders(runAt)).resolves.toBe(0);
    await expect(prisma.eventReminderDispatch.count({ where: { eventId: event.id } })).resolves.toBe(0);

    await dropTrigger("fail_reminder_email");
    await expect(processEventReminders(runAt)).resolves.toBe(1);
    await expect(processEventReminders(runAt)).resolves.toBe(0);

    const dispatch = await prisma.eventReminderDispatch.findUniqueOrThrow({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });
    expect(dispatch.sentAt).not.toBeNull();
    await expect(
      prisma.outgoingEmail.count({
        where: { template: EVENT_REMINDER_EMAIL_TEMPLATE, toRecipients: user.email },
      })
    ).resolves.toBe(1);
  });
});

describe("Postausgang: kein Doppelversand, kein endloser Re-Claim", () => {
  beforeEach(async () => {
    mockSendMail.mockReset();
    await prisma.outgoingEmail.deleteMany();
  });

  afterEach(() => dropTrigger("fail_sent_update"));

  async function queueEmail(to: string) {
    const { outboxId } = await sendTemplateEmail({
      template: POLL_TEMPLATE,
      variables: { pollTitle: "Test", pollDescription: "", pollUrl: "http://localhost/u/x", userName: "Mitglied" },
      to,
    });
    return outboxId;
  }

  it("versendet nach erfolgreicher SMTP-Übergabe nicht erneut, wenn das SENT-Update scheitert", async () => {
    const outboxId = await queueEmail("einmal@example.com");
    mockSendMail.mockResolvedValue({ messageId: "smtp-1" });
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "fail_sent_update" BEFORE UPDATE ON "OutgoingEmail"
      WHEN NEW."status" = 'SENT'
      BEGIN SELECT RAISE(ABORT, 'Testfehler SENT'); END
    `);

    await expect(processDueEmailOutboxBatch()).rejects.toThrow();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const pending = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: outboxId } });
    expect(pending.status).toBe(OutgoingEmailStatus.PROCESSING);

    // Auch nach Ablauf der Sperre wird nur noch bestätigt, nicht neu versendet.
    await dropTrigger("fail_sent_update");
    await prisma.outgoingEmail.update({
      where: { id: outboxId },
      data: { lockedUntil: new Date(Date.now() - 1_000) },
    });
    await processDueEmailOutboxBatch();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    await expect(prisma.outgoingEmail.findUniqueOrThrow({ where: { id: outboxId } })).resolves.toMatchObject({
      status: OutgoingEmailStatus.SENT,
      lockedUntil: null,
    });
  });

  it("lässt eine nach Abbruch erneut beanspruchte E-Mail außerhalb des 24-h-Fensters fehlschlagen", async () => {
    const outboxId = await queueEmail("absturz@example.com");
    await prisma.outgoingEmail.update({
      where: { id: outboxId },
      data: {
        status: OutgoingEmailStatus.PROCESSING,
        attemptCount: 3,
        lockedUntil: new Date(Date.now() - 1_000),
        firstQueuedAt: new Date(Date.now() - MAX_RETRY_WINDOW_MS - 60_000),
      },
    });

    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    expect(mockSendMail).not.toHaveBeenCalled();
    const failed = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: outboxId } });
    expect(failed.status).toBe(OutgoingEmailStatus.FAILED);
    expect(failed.attemptCount).toBe(4);
    expect(failed.lockedUntil).toBeNull();
    expect(failed.lastError).toContain("abgebrochen");
  });

  it("versendet eine nach Abbruch erneut beanspruchte E-Mail innerhalb des Fensters und zählt den Versuch", async () => {
    const outboxId = await queueEmail("neuversuch@example.com");
    await prisma.outgoingEmail.update({
      where: { id: outboxId },
      data: { status: OutgoingEmailStatus.PROCESSING, attemptCount: 1, lockedUntil: new Date(Date.now() - 1_000) },
    });
    mockSendMail.mockResolvedValue({ messageId: "smtp-2" });

    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    await expect(prisma.outgoingEmail.findUniqueOrThrow({ where: { id: outboxId } })).resolves.toMatchObject({
      status: OutgoingEmailStatus.SENT,
      attemptCount: 2,
    });
  });
});

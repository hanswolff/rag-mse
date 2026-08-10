import { OutgoingEmailStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getPolls } from "@/app/api/polls/route";
import { GET as getPoll } from "@/app/api/polls/[id]/route";
import { POST as castVote, DELETE as withdrawVote } from "@/app/api/polls/[id]/vote/route";
import { POST as publishPoll } from "@/app/api/admin/polls/[id]/publish/route";
import { POST as closePoll } from "@/app/api/admin/polls/[id]/close/route";
import { POST as reopenPoll } from "@/app/api/admin/polls/[id]/reopen/route";
import { POST as retryOutgoingEmail } from "@/app/api/admin/outgoing-emails/[id]/retry/route";
import ShortLinkPage from "@/app/u/[shortCode]/page";
import { sendTemplateEmail } from "@/lib/email-sender";
import { processDueEmailOutboxBatch } from "@/lib/email/outbox-worker";
import {
  FAST_RETRY_DELAY_MS,
  SLOW_RETRY_DELAY_MS,
  FAST_RETRY_COUNT,
  MAX_RETRY_WINDOW_MS,
} from "@/lib/email/types";
import nodemailer from "nodemailer";
import { apiRequest, routeContext } from "./helpers/api";
import { loginAs } from "./helpers/auth";
import { createAdmin, createPoll, createUser } from "./helpers/factories";

// Einzige zusätzliche Systemgrenze dieser Datei: der SMTP-Transport.
// Queue, Statusübergänge und Zeitfenster laufen real über die SQLite.
jest.mock("nodemailer", () => {
  const sendMail = jest.fn();
  const verify = jest.fn();
  const transport = { sendMail, verify };
  const createTransport = jest.fn(() => transport);
  return { __esModule: true, default: { createTransport }, createTransport };
});

const smtpTransport = (
  nodemailer as unknown as { createTransport: () => { sendMail: jest.Mock; verify: jest.Mock } }
).createTransport();
const mockSendMail = smtpTransport.sendMail;

beforeAll(() => {
  // Ohne diese Werte weicht der Worker in den Dev-Modus aus bzw. scheitert an
  // fehlender Konfiguration, statt den (gemockten) SMTP-Transport zu benutzen.
  process.env.EMAIL_DEV_MODE = "false";
  process.env.SMTP_HOST = "smtp.integration.example";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "postausgang";
  process.env.SMTP_PASSWORD = "integration-geheim";
  process.env.SMTP_FROM = "noreply@example.com";
});

function voteRequest(pollId: string, optionIds: string[]) {
  return castVote(
    apiRequest("POST", `/api/polls/${pollId}/vote`, { body: { optionIds } }),
    routeContext({ id: pollId })
  );
}

async function renderShortLinkDigest(shortCode: string): Promise<string> {
  try {
    await ShortLinkPage({ params: Promise.resolve({ shortCode }) });
    return "";
  } catch (error) {
    return (error as { digest?: string }).digest ?? "";
  }
}

// Der Verzögerungswert entsteht zwischen Testbeginn und Worker-Lauf; deshalb
// ein Toleranzfenster statt eines exakten Zeitpunkts.
function expectDelayCloseTo(target: Date | null, startedAtMs: number, expectedDelayMs: number) {
  expect(target).not.toBeNull();
  const delta = (target as Date).getTime() - startedAtMs;
  expect(delta).toBeGreaterThanOrEqual(expectedDelayMs - 1_000);
  expect(delta).toBeLessThanOrEqual(expectedDelayMs + 15_000);
}

describe("Integrationsschicht: Umfrage-Zustandsautomat", () => {
  it("lehnt Stimmabgabe bei Entwurf ab und legt keine Stimme an", async () => {
    const member = await createUser();
    const poll = await createPoll({ status: "DRAFT" });
    loginAs(member);

    // Entwürfe sind für Mitglieder unsichtbar: Detailansicht liefert 404
    const detailResponse = await getPoll(
      apiRequest("GET", `/api/polls/${poll.id}`),
      routeContext({ id: poll.id })
    );
    expect(detailResponse.status).toBe(404);

    // Abstimmen wird mit 409 abgelehnt (Umfrage existiert, ist aber nicht live)
    const voteResponse = await voteRequest(poll.id, [poll.options[0].id]);
    expect(voteResponse.status).toBe(409);

    const fromDb = await prisma.poll.findUniqueOrThrow({ where: { id: poll.id } });
    expect(fromDb.status).toBe("DRAFT");
    await expect(prisma.pollVote.count({ where: { pollId: poll.id } })).resolves.toBe(0);
  });

  it("nimmt Stimmen bei Live an und persistiert sie in der Datenbank", async () => {
    const member = await createUser();
    const poll = await createPoll({ status: "LIVE" });
    loginAs(member);

    const voteResponse = await voteRequest(poll.id, [poll.options[1].id]);
    expect(voteResponse.status).toBe(200);

    const votes = await prisma.pollVote.findMany({ where: { pollId: poll.id } });
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ userId: member.id, optionId: poll.options[1].id });

    // Die Detailansicht spiegelt die gespeicherte Stimme zurück
    const detailResponse = await getPoll(
      apiRequest("GET", `/api/polls/${poll.id}`),
      routeContext({ id: poll.id })
    );
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.userVoteOptionIds).toEqual([poll.options[1].id]);
  });

  it("lehnt Stimmabgabe bei Geschlossen ab und lässt bestehende Stimmen unverändert", async () => {
    const admin = await createAdmin();
    const member = await createUser();
    const poll = await createPoll({ status: "LIVE" });

    loginAs(member);
    expect((await voteRequest(poll.id, [poll.options[0].id])).status).toBe(200);

    loginAs(admin);
    const closeResponse = await closePoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/close`),
      routeContext({ id: poll.id })
    );
    expect(closeResponse.status).toBe(200);
    await expect(
      prisma.poll.findUniqueOrThrow({ where: { id: poll.id } })
    ).resolves.toMatchObject({ status: "CLOSED" });

    loginAs(member);
    const voteResponse = await voteRequest(poll.id, [poll.options[1].id]);
    expect(voteResponse.status).toBe(409);

    const votes = await prisma.pollVote.findMany({ where: { pollId: poll.id } });
    expect(votes).toHaveLength(1);
    expect(votes[0].optionId).toBe(poll.options[0].id);
  });

  it("durchläuft Veröffentlichen → Schließen → Wieder öffnen mit echten DB-Zuständen", async () => {
    const admin = await createAdmin();
    const poll = await createPoll({ status: "DRAFT" });
    loginAs(admin);

    const publishResponse = await publishPoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/publish`),
      routeContext({ id: poll.id })
    );
    expect(publishResponse.status).toBe(200);
    const afterPublish = await prisma.poll.findUniqueOrThrow({ where: { id: poll.id } });
    expect(afterPublish.status).toBe("LIVE");
    expect(afterPublish.shortCode).toBe(poll.id);

    // Doppelte Veröffentlichung (z. B. Doppelklick) wird abgewiesen
    const republishResponse = await publishPoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/publish`),
      routeContext({ id: poll.id })
    );
    expect(republishResponse.status).toBe(409);

    const closeResponse = await closePoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/close`),
      routeContext({ id: poll.id })
    );
    expect(closeResponse.status).toBe(200);
    await expect(
      prisma.poll.findUniqueOrThrow({ where: { id: poll.id } })
    ).resolves.toMatchObject({ status: "CLOSED" });

    // Wieder öffnen ist nur aus Geschlossen erlaubt …
    const reopenResponse = await reopenPoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/reopen`),
      routeContext({ id: poll.id })
    );
    expect(reopenResponse.status).toBe(200);
    await expect(
      prisma.poll.findUniqueOrThrow({ where: { id: poll.id } })
    ).resolves.toMatchObject({ status: "LIVE" });

    // … und ein zweites Mal direkt hintereinander deshalb nicht
    const rereopenResponse = await reopenPoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/reopen`),
      routeContext({ id: poll.id })
    );
    expect(rereopenResponse.status).toBe(409);
  });

  it("ersetzt bei Einzelauswahl die alte Stimme statt sie zu doppeln", async () => {
    const member = await createUser();
    const poll = await createPoll({ status: "LIVE" });
    loginAs(member);

    expect((await voteRequest(poll.id, [poll.options[0].id])).status).toBe(200);
    expect((await voteRequest(poll.id, [poll.options[1].id])).status).toBe(200);

    const votes = await prisma.pollVote.findMany({ where: { pollId: poll.id, userId: member.id } });
    expect(votes).toHaveLength(1);
    expect(votes[0].optionId).toBe(poll.options[1].id);

    // Zwei Optionen auf einmal sind bei Einzelauswahl unzulässig und ändern nichts
    const invalidResponse = await voteRequest(poll.id, [poll.options[0].id, poll.options[1].id]);
    expect(invalidResponse.status).toBe(400);
    await expect(
      prisma.pollVote.count({ where: { pollId: poll.id, userId: member.id } })
    ).resolves.toBe(1);
  });

  it("erlaubt bei Mehrfachauswahl mehrere Optionen und ersetzt beim erneuten Abstimmen den ganzen Satz", async () => {
    const member = await createUser();
    const poll = await createPoll({
      status: "LIVE",
      multipleChoice: true,
      optionTexts: ["Montag", "Mittwoch", "Freitag"],
    });
    loginAs(member);

    const firstVote = await voteRequest(poll.id, [poll.options[0].id, poll.options[2].id]);
    expect(firstVote.status).toBe(200);
    const firstVotes = await prisma.pollVote.findMany({ where: { pollId: poll.id, userId: member.id } });
    expect(firstVotes.map((vote) => vote.optionId).sort()).toEqual(
      [poll.options[0].id, poll.options[2].id].sort()
    );

    const secondVote = await voteRequest(poll.id, [poll.options[1].id]);
    expect(secondVote.status).toBe(200);
    const secondVotes = await prisma.pollVote.findMany({ where: { pollId: poll.id, userId: member.id } });
    expect(secondVotes).toHaveLength(1);
    expect(secondVotes[0].optionId).toBe(poll.options[1].id);
  });

  it("zieht die eigene Stimme per DELETE zurück, aber nur bei Live", async () => {
    const member = await createUser();
    const poll = await createPoll({ status: "LIVE" });
    loginAs(member);

    expect((await voteRequest(poll.id, [poll.options[0].id])).status).toBe(200);

    const withdrawResponse = await withdrawVote(
      apiRequest("DELETE", `/api/polls/${poll.id}/vote`),
      routeContext({ id: poll.id })
    );
    expect(withdrawResponse.status).toBe(200);
    await expect(prisma.pollVote.count({ where: { pollId: poll.id } })).resolves.toBe(0);

    await prisma.poll.update({ where: { id: poll.id }, data: { status: "CLOSED" } });
    const closedWithdraw = await withdrawVote(
      apiRequest("DELETE", `/api/polls/${poll.id}/vote`),
      routeContext({ id: poll.id })
    );
    expect(closedWithdraw.status).toBe(409);
  });

  it("listet Mitgliedern standardmäßig nur Live-Umfragen", async () => {
    const member = await createUser();
    const draft = await createPoll({ status: "DRAFT" });
    const live = await createPoll({ status: "LIVE" });
    const closed = await createPoll({ status: "CLOSED" });
    loginAs(member);

    const response = await getPolls(apiRequest("GET", "/api/polls?limit=50"));
    expect(response.status).toBe(200);
    const json = await response.json();
    const ids = json.polls.map((poll: { id: string }) => poll.id);

    expect(ids).toContain(live.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(closed.id);
  });
});

describe("Integrationsschicht: Kurzlink /u/<code>", () => {
  it("löst den beim Veröffentlichen gesetzten shortCode DB-seitig auf die richtige Umfrage auf", async () => {
    const admin = await createAdmin();
    const firstDraft = await createPoll({ status: "DRAFT" });
    const secondDraft = await createPoll({ status: "DRAFT" });
    loginAs(admin);

    for (const draft of [firstDraft, secondDraft]) {
      const response = await publishPoll(
        apiRequest("POST", `/api/admin/polls/${draft.id}/publish`),
        routeContext({ id: draft.id })
      );
      expect(response.status).toBe(200);
    }

    const resolvedFirst = await prisma.poll.findUniqueOrThrow({ where: { shortCode: firstDraft.id } });
    const resolvedSecond = await prisma.poll.findUniqueOrThrow({ where: { shortCode: secondDraft.id } });
    expect(resolvedFirst.id).toBe(firstDraft.id);
    expect(resolvedFirst.title).toBe(firstDraft.title);
    expect(resolvedSecond.id).toBe(secondDraft.id);
    expect(resolvedFirst.id).not.toBe(resolvedSecond.id);
  });

  it("leitet bei bekanntem Kurzcode auf die Detailseite der richtigen Umfrage weiter", async () => {
    const poll = await createPoll({ status: "LIVE" });
    const shortCode = "u7abc123";
    await prisma.poll.update({ where: { id: poll.id }, data: { shortCode } });

    const digest = await renderShortLinkDigest(shortCode);
    expect(digest).toMatch(/^NEXT_REDIRECT/);
    expect(digest).toContain(`/umfragen/${poll.id}`);
  });

  it("liefert bei unbekanntem Kurzcode notFound", async () => {
    const digest = await renderShortLinkDigest("gibtesnicht1");
    expect(digest).toMatch(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("löst den beim Veröffentlichen gesetzten Kurzcode über die Kurzlink-Seite auf", async () => {
    // Ende-zu-Ende über die echten Bausteine: Publish-Route setzt
    // shortCode = poll.id (8-stellige Kurz-ID wie aus der Erstellungsroute),
    // die Kurzlink-Seite leitet darauf zur Detailseite weiter.
    const admin = await createAdmin();
    const draft = await createPoll({ status: "DRAFT" });
    loginAs(admin);
    const response = await publishPoll(
      apiRequest("POST", `/api/admin/polls/${draft.id}/publish`),
      routeContext({ id: draft.id })
    );
    expect(response.status).toBe(200);

    const published = await prisma.poll.findUniqueOrThrow({ where: { id: draft.id } });
    expect(published.shortCode).toBe(draft.id);
    expect(draft.id).toMatch(/^[a-z0-9]{8}$/);

    const digest = await renderShortLinkDigest(draft.id);
    expect(digest).toMatch(/^NEXT_REDIRECT/);
    expect(digest).toContain(`/umfragen/${draft.id}`);
  });

  it("akzeptiert auch 25-stellige cuid-Kurzcodes aus Altbeständen", async () => {
    // Vor generatePollId() angelegte Umfragen tragen eine cuid als shortCode;
    // deren bereits verschickte Mail-Links müssen weiter funktionieren.
    const poll = await createPoll({ status: "LIVE" });
    const legacyShortCode = "clegacy1234567890abcdefgh";
    expect(legacyShortCode).toHaveLength(25);
    await prisma.poll.update({ where: { id: poll.id }, data: { shortCode: legacyShortCode } });

    const digest = await renderShortLinkDigest(legacyShortCode);
    expect(digest).toMatch(/^NEXT_REDIRECT/);
    expect(digest).toContain(`/umfragen/${poll.id}`);
  });
});

describe("Integrationsschicht: Postausgang", () => {
  beforeEach(async () => {
    mockSendMail.mockReset();
    // Rückstände früherer Tests (z. B. Benachrichtigungen aus Veröffentlichungen)
    // würden sonst vom Worker mitverarbeitet.
    await prisma.outgoingEmail.deleteMany();
  });

  afterEach(() => {
    delete process.env.EMAIL_OUTBOX_BATCH_SIZE;
  });

  async function queueEmail(to = "empfaenger@example.com") {
    const result = await sendTemplateEmail({
      template: "umfrage-benachrichtigung",
      variables: {
        pollTitle: "Übungsschießen im März",
        pollDescription: "Bitte abstimmen.",
        pollUrl: "http://localhost:3000/u/test",
        userName: "Mitglied",
      },
      to,
    });
    return prisma.outgoingEmail.findUniqueOrThrow({ where: { id: result.outboxId } });
  }

  it("reiht beim Veröffentlichen echte OutgoingEmail-Datensätze für benachrichtigte Mitglieder ein", async () => {
    const admin = await createAdmin();
    const member = await createUser();
    const optOut = await createUser({ pollNotificationEnabled: false });
    const poll = await createPoll({ status: "DRAFT" });

    const expectedRecipients = await prisma.user.findMany({
      where: { pollNotificationEnabled: true, activatedAt: { not: null } },
      select: { email: true },
    });

    loginAs(admin);
    const response = await publishPoll(
      apiRequest("POST", `/api/admin/polls/${poll.id}/publish`),
      routeContext({ id: poll.id })
    );
    expect(response.status).toBe(200);

    const queuedEmails = await prisma.outgoingEmail.findMany({
      where: { template: "umfrage-benachrichtigung" },
    });
    expect(queuedEmails.map((email) => email.toRecipients).sort()).toEqual(
      expectedRecipients.map((user) => user.email).sort()
    );
    for (const email of queuedEmails) {
      expect(email.status).toBe(OutgoingEmailStatus.QUEUED);
      expect(email.subject).toContain(poll.title);
      expect(email.sentAt).toBeNull();
    }
    expect(queuedEmails.map((email) => email.toRecipients)).toContain(member.email);
    expect(queuedEmails.map((email) => email.toRecipients)).not.toContain(optOut.email);

    // Dedupe-Grundlage: je benachrichtigtem Mitglied genau ein Dispatch-Eintrag
    await expect(
      prisma.pollNotificationDispatch.count({ where: { pollId: poll.id } })
    ).resolves.toBe(expectedRecipients.length);
  });

  it("legt beim Einreihen einen QUEUED-Datensatz mit sofortiger Fälligkeit an", async () => {
    const before = Date.now();
    const email = await queueEmail("queued@example.com");

    expect(email.status).toBe(OutgoingEmailStatus.QUEUED);
    expect(email.toRecipients).toBe("queued@example.com");
    expect(email.attemptCount).toBe(0);
    expect(email.sentAt).toBeNull();
    expect(email.lastError).toBeNull();
    expect(email.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
    expect(email.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now() + 1_000);
  });

  it("setzt SENT mit sentAt, sobald die E-Mail an den SMTP-Server übergeben wurde", async () => {
    const email = await queueEmail("erfolg@example.com");
    mockSendMail.mockResolvedValue({ messageId: "smtp-nachricht-1" });

    const processed = await processDueEmailOutboxBatch();
    expect(processed).toBe(1);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      to: "erfolg@example.com",
      subject: email.subject,
    });

    const sent = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(sent.status).toBe(OutgoingEmailStatus.SENT);
    expect(sent.sentAt).not.toBeNull();
    expect(sent.attemptCount).toBe(1);
    expect(sent.lockedUntil).toBeNull();
    expect(sent.lastError).toBeNull();
  });

  it("plant nach transientem SMTP-Fehler einen schnellen Retry (2 Minuten) ein", async () => {
    const email = await queueEmail("wackelig@example.com");
    mockSendMail.mockRejectedValue(new Error("ETIMEDOUT: connection timed out"));
    const startedAt = Date.now();

    const processed = await processDueEmailOutboxBatch();
    expect(processed).toBe(1);

    const retrying = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(retrying.status).toBe(OutgoingEmailStatus.RETRYING);
    expect(retrying.attemptCount).toBe(1);
    expect(retrying.lastError).toContain("Transient SMTP error");
    expect(retrying.sentAt).toBeNull();
    expect(retrying.lockedUntil).toBeNull();
    expectDelayCloseTo(retrying.nextAttemptAt, startedAt, FAST_RETRY_DELAY_MS);

    // Vor Fälligkeit fasst der Worker die Zeile nicht erneut an (Zeitfenster real)
    mockSendMail.mockClear();
    await expect(processDueEmailOutboxBatch()).resolves.toBe(0);
    expect(mockSendMail).not.toHaveBeenCalled();
    await expect(
      prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } })
    ).resolves.toMatchObject({ status: OutgoingEmailStatus.RETRYING, attemptCount: 1 });
  });

  it("wechselt nach den schnellen Versuchen auf das langsame Retry-Intervall (10 Minuten)", async () => {
    const email = await queueEmail("zaeh@example.com");
    await prisma.outgoingEmail.update({
      where: { id: email.id },
      data: { attemptCount: FAST_RETRY_COUNT },
    });
    mockSendMail.mockRejectedValue(new Error("Connection refused: ECONNREFUSED"));
    const startedAt = Date.now();

    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    const retrying = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(retrying.status).toBe(OutgoingEmailStatus.RETRYING);
    expect(retrying.attemptCount).toBe(FAST_RETRY_COUNT + 1);
    expectDelayCloseTo(retrying.nextAttemptAt, startedAt, SLOW_RETRY_DELAY_MS);
  });

  it("markiert die E-Mail nach Ausschöpfung des 24-Stunden-Fensters dauerhaft als FAILED", async () => {
    const email = await queueEmail("aussichtslos@example.com");
    // Zeitfenster real über die DB: die erste Einreihung liegt länger als 24 h zurück
    await prisma.outgoingEmail.update({
      where: { id: email.id },
      data: { firstQueuedAt: new Date(Date.now() - MAX_RETRY_WINDOW_MS - 60 * 60 * 1000) },
    });
    mockSendMail.mockRejectedValue(new Error("ETIMEDOUT: connection timed out"));

    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    const failed = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(failed.status).toBe(OutgoingEmailStatus.FAILED);
    expect(failed.lastError).toContain("Transient SMTP error");
    expect(failed.sentAt).toBeNull();
    expect(failed.lockedUntil).toBeNull();

    // FAILED ist ein Endzustand: der Worker beansprucht die Zeile nicht mehr
    mockSendMail.mockClear();
    await expect(processDueEmailOutboxBatch()).resolves.toBe(0);
    expect(mockSendMail).not.toHaveBeenCalled();
    await expect(
      prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } })
    ).resolves.toMatchObject({ status: OutgoingEmailStatus.FAILED });
  });

  it("lässt permanente SMTP-Fehler ohne Retry sofort dauerhaft fehlschlagen", async () => {
    const email = await queueEmail("abgelehnt@example.com");
    mockSendMail.mockRejectedValue(new Error("Invalid credentials: authentication failed"));

    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    const failed = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(failed.status).toBe(OutgoingEmailStatus.FAILED);
    expect(failed.attemptCount).toBe(1);
    expect(failed.lastError).toContain("Permanent SMTP error");
  });

  it("plant per Admin-Retry eine FAILED-E-Mail sofort neu ein und versendet sie beim nächsten Lauf", async () => {
    const admin = await createAdmin();
    const email = await queueEmail("zweite-chance@example.com");
    mockSendMail.mockRejectedValue(new Error("Invalid credentials"));
    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);
    await expect(
      prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } })
    ).resolves.toMatchObject({ status: OutgoingEmailStatus.FAILED });

    // Die Route stößt fire-and-forget einen Worker-Lauf an; Batchgröße 0 hält
    // ihn deterministisch leer, damit der RETRYING-Zustand beobachtbar bleibt.
    process.env.EMAIL_OUTBOX_BATCH_SIZE = "0";
    loginAs(admin);
    const before = Date.now();
    const retryResponse = await retryOutgoingEmail(
      apiRequest("POST", `/api/admin/outgoing-emails/${email.id}/retry`),
      routeContext({ id: email.id })
    );
    expect(retryResponse.status).toBe(200);

    const rescheduled = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(rescheduled.status).toBe(OutgoingEmailStatus.RETRYING);
    expect(rescheduled.lastError).toBeNull();
    expect(rescheduled.lockedUntil).toBeNull();
    expect(rescheduled.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
    expect(rescheduled.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now() + 1_000);

    // Nächster regulärer Worker-Lauf mit funktionierendem SMTP: Übergabe gelingt
    delete process.env.EMAIL_OUTBOX_BATCH_SIZE;
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: "smtp-nachricht-retry" });
    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    const sent = await prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } });
    expect(sent.status).toBe(OutgoingEmailStatus.SENT);
    expect(sent.sentAt).not.toBeNull();
  });

  it("lehnt den Admin-Retry für nicht fehlgeschlagene E-Mails ab", async () => {
    const admin = await createAdmin();
    const email = await queueEmail("schon-raus@example.com");
    mockSendMail.mockResolvedValue({ messageId: "smtp-nachricht-2" });
    await expect(processDueEmailOutboxBatch()).resolves.toBe(1);

    loginAs(admin);
    const retryResponse = await retryOutgoingEmail(
      apiRequest("POST", `/api/admin/outgoing-emails/${email.id}/retry`),
      routeContext({ id: email.id })
    );
    expect(retryResponse.status).toBe(400);
    await expect(
      prisma.outgoingEmail.findUniqueOrThrow({ where: { id: email.id } })
    ).resolves.toMatchObject({ status: OutgoingEmailStatus.SENT });
  });
});

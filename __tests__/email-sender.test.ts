import nodemailer from "nodemailer";
import { renderEmailTemplate } from "../lib/email-templates";
import {
  classifyEmailError,
  getNextRetryTimeForTransientFailure,
  processDueEmailOutboxBatch,
  sendTemplateEmail,
  stopEmailOutboxWorkerForTests,
} from "../lib/email-sender";
import { prisma } from "../lib/prisma";

jest.mock("nodemailer");
jest.mock("../lib/email-templates");
jest.mock("../lib/prisma", () => ({
  prisma: {
    outgoingEmail: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockSendMail = jest.fn();
const mockCreateTransport = jest.mocked(nodemailer.createTransport);
const mockRenderEmailTemplate = jest.mocked(renderEmailTemplate);
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("Email Sender", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASSWORD = "password";
    process.env.SMTP_FROM = "noreply@example.com";

    jest.clearAllMocks();
    stopEmailOutboxWorkerForTests();

    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    mockRenderEmailTemplate.mockResolvedValue({
      subject: "Test Subject",
      body: "Test Body",
    });
  });

  describe("sendTemplateEmail", () => {
    it("queues email in database", async () => {
      (mockPrisma.outgoingEmail.create as jest.Mock).mockResolvedValue({
        id: "mail-1",
        toRecipients: "recipient@example.com",
      });

      const result = await sendTemplateEmail({
        template: "test-template",
        variables: { name: "Test" },
        to: "recipient@example.com",
      });

      expect(mockPrisma.outgoingEmail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            template: "test-template",
            toRecipients: "recipient@example.com",
            subject: "Test Subject",
            textBody: "Test Body",
          }),
        })
      );
      expect(result).toEqual({ queued: true, outboxId: "mail-1" });
    });

    it("throws for empty recipients", async () => {
      await expect(sendTemplateEmail({ template: "test", variables: {}, to: "   " })).rejects.toThrow(
        "Mindestens ein E-Mail-Empfänger ist erforderlich"
      );
    });
  });

  describe("processDueEmailOutboxBatch", () => {
    it("sends queued email and marks as sent", async () => {
      const firstQueuedAt = new Date("2026-02-08T10:00:00.000Z");
      const lastAttemptAt = new Date("2026-02-08T10:01:00.000Z");

      (mockPrisma.outgoingEmail.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "mail-1" })
        .mockResolvedValueOnce(null);
      (mockPrisma.outgoingEmail.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.outgoingEmail.findUnique as jest.Mock).mockResolvedValue({
        id: "mail-1",
        template: "contact",
        toRecipients: "a@example.com, b@example.com",
        subject: "Subject",
        textBody: "Body",
        htmlBody: "Body",
        attemptCount: 1,
        firstQueuedAt,
        lastAttemptAt,
      });
      mockSendMail.mockResolvedValue({ messageId: "m-1" });
      (mockPrisma.outgoingEmail.update as jest.Mock).mockResolvedValue({});

      const processed = await processDueEmailOutboxBatch();

      expect(processed).toBe(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "a@example.com, b@example.com",
          subject: "Subject",
        })
      );
      expect(mockPrisma.outgoingEmail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "mail-1" },
          data: expect.objectContaining({
            status: "SENT",
            lastError: null,
          }),
        })
      );
    });

    it("schedules retry for transient SMTP errors", async () => {
      const now = new Date();
      const firstQueuedAt = new Date(now.getTime() - 10 * 60 * 1000);

      (mockPrisma.outgoingEmail.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "mail-2" })
        .mockResolvedValueOnce(null);
      (mockPrisma.outgoingEmail.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.outgoingEmail.findUnique as jest.Mock).mockResolvedValue({
        id: "mail-2",
        template: "contact",
        toRecipients: "a@example.com",
        subject: "Subject",
        textBody: "Body",
        htmlBody: "Body",
        attemptCount: 2,
        firstQueuedAt,
      });

      const transientError = new Error("Connection timeout") as Error & { code?: string };
      transientError.code = "ETIMEDOUT";
      mockSendMail.mockRejectedValue(transientError);
      (mockPrisma.outgoingEmail.update as jest.Mock).mockResolvedValue({});

      await processDueEmailOutboxBatch();

      expect(mockPrisma.outgoingEmail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "mail-2" },
          data: expect.objectContaining({ status: "RETRYING" }),
        })
      );
    });

    it("marks permanent errors as failed", async () => {
      const firstQueuedAt = new Date("2026-02-08T10:00:00.000Z");

      (mockPrisma.outgoingEmail.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "mail-3" })
        .mockResolvedValueOnce(null);
      (mockPrisma.outgoingEmail.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.outgoingEmail.findUnique as jest.Mock).mockResolvedValue({
        id: "mail-3",
        template: "contact",
        toRecipients: "a@example.com",
        subject: "Subject",
        textBody: "Body",
        htmlBody: "Body",
        attemptCount: 1,
        firstQueuedAt,
      });

      mockSendMail.mockRejectedValue(new Error("Invalid credentials"));
      (mockPrisma.outgoingEmail.update as jest.Mock).mockResolvedValue({});

      await processDueEmailOutboxBatch();

      expect(mockPrisma.outgoingEmail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "mail-3" },
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });
  });

  describe("retry scheduling", () => {
    it("uses 2-minute delay for first three retries", () => {
      const now = new Date("2026-02-08T12:00:00.000Z");
      const firstQueuedAt = new Date("2026-02-08T11:00:00.000Z");

      const next = getNextRetryTimeForTransientFailure(3, firstQueuedAt, now);
      expect(next).not.toBeNull();
      expect(next?.getTime()).toBe(now.getTime() + 2 * 60 * 1000);
    });

    it("uses 10-minute delay after first three retries", () => {
      const now = new Date("2026-02-08T12:00:00.000Z");
      const firstQueuedAt = new Date("2026-02-08T11:00:00.000Z");

      const next = getNextRetryTimeForTransientFailure(4, firstQueuedAt, now);
      expect(next).not.toBeNull();
      expect(next?.getTime()).toBe(now.getTime() + 10 * 60 * 1000);
    });

    it("stops retrying after 24 hours", () => {
      const firstQueuedAt = new Date("2026-02-07T12:00:00.000Z");
      const now = new Date("2026-02-08T12:00:00.000Z");

      const next = getNextRetryTimeForTransientFailure(10, firstQueuedAt, now);
      expect(next).toBeNull();
    });
  });

  describe("classifyEmailError", () => {
    it("classifies transient errors", () => {
      const error = new Error("Connection timeout");
      const result = classifyEmailError(error);
      expect(result.type).toBe("transient");
    });

    it("classifies permanent errors", () => {
      const error = new Error("Invalid credentials");
      const result = classifyEmailError(error);
      expect(result.type).toBe("permanent");
    });

    it("classifies unknown errors", () => {
      const error = new Error("Unexpected condition");
      const result = classifyEmailError(error);
      expect(result.type).toBe("unknown");
    });
  });
});

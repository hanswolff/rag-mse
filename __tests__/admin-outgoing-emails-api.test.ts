import { NextRequest } from "next/server";
import { OutgoingEmailStatus } from "@prisma/client";
import { GET } from "@/app/api/admin/outgoing-emails/route";
import { POST } from "@/app/api/admin/outgoing-emails/[id]/retry/route";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { processDueEmailOutboxBatch } from "@/lib/email-sender";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outgoingEmail: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/email-sender", () => ({
  processDueEmailOutboxBatch: jest.fn(),
}));

describe("/api/admin/outgoing-emails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("returns paginated outgoing emails from the last 30 days", async () => {
    (prisma.outgoingEmail.findMany as jest.Mock).mockResolvedValue([
      {
        id: "email-1",
        template: "contact",
        toRecipients: "admin@example.com",
        subject: "Kontaktanfrage",
        status: OutgoingEmailStatus.SENT,
        attemptCount: 1,
        firstQueuedAt: new Date("2026-02-15T09:00:00.000Z"),
        nextAttemptAt: new Date("2026-02-15T09:00:00.000Z"),
        lastAttemptAt: new Date("2026-02-15T09:00:05.000Z"),
        lastError: null,
        sentAt: new Date("2026-02-15T09:00:05.000Z"),
        createdAt: new Date("2026-02-15T09:00:00.000Z"),
      },
    ]);
    (prisma.outgoingEmail.count as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/admin/outgoing-emails?page=1&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(requireAdmin).toHaveBeenCalled();
    expect(data.emails).toHaveLength(1);
    expect(data.emails[0].subject).toBe("Kontaktanfrage");
    expect(data.emails[0].attemptCount).toBe(1);
    expect(data.pagination).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    });

    const firstCall = (prisma.outgoingEmail.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("applies search query to subject, recipient and template", async () => {
    (prisma.outgoingEmail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.outgoingEmail.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/outgoing-emails?q=kontakt");
    await GET(request);

    const firstCall = (prisma.outgoingEmail.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.OR).toEqual([
      { subject: { contains: "kontakt" } },
      { toRecipients: { contains: "kontakt" } },
      { template: { contains: "kontakt" } },
    ]);
  });

  it("enforces max page size", async () => {
    (prisma.outgoingEmail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.outgoingEmail.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/outgoing-emails?limit=999&page=2");
    await GET(request);

    const firstCall = (prisma.outgoingEmail.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.take).toBe(100);
    expect(firstCall.skip).toBe(100);
  });
});

describe("/api/admin/outgoing-emails/[id]/retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("retries a failed email", async () => {
    (prisma.outgoingEmail.findUnique as jest.Mock).mockResolvedValue({
      id: "email-failed",
      status: OutgoingEmailStatus.FAILED,
    });
    (prisma.outgoingEmail.update as jest.Mock).mockResolvedValue({});
    (processDueEmailOutboxBatch as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/admin/outgoing-emails/email-failed/retry", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "email-failed" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain("erneuten Versand eingeplant");
    expect(prisma.outgoingEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "email-failed" },
        data: expect.objectContaining({
          status: OutgoingEmailStatus.RETRYING,
          lockedUntil: null,
          lastError: null,
        }),
      })
    );
    expect(processDueEmailOutboxBatch).toHaveBeenCalled();
  });

  it("rejects retry for non-failed email", async () => {
    (prisma.outgoingEmail.findUnique as jest.Mock).mockResolvedValue({
      id: "email-sent",
      status: OutgoingEmailStatus.SENT,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/outgoing-emails/email-sent/retry", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "email-sent" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Nur fehlgeschlagene E-Mails");
    expect(prisma.outgoingEmail.update).not.toHaveBeenCalled();
  });
});

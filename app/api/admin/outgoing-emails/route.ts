import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const LOOKBACK_DAYS = 30;

function parsePageNumber(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

function parsePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function getCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  return cutoff;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const skip = (page - 1) * limit;
  const query = (searchParams.get("q") || "").trim();
  const cutoffDate = getCutoffDate();

  const where = {
    createdAt: { gte: cutoffDate },
    ...(query
      ? {
          OR: [
            { subject: { contains: query } },
            { toRecipients: { contains: query } },
            { template: { contains: query } },
          ],
        }
      : {}),
  };

  const [emails, total] = await Promise.all([
    prisma.outgoingEmail.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        template: true,
        toRecipients: true,
        subject: true,
        status: true,
        attemptCount: true,
        firstQueuedAt: true,
        nextAttemptAt: true,
        lastAttemptAt: true,
        lastError: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.outgoingEmail.count({ where }),
  ]);

  return NextResponse.json({
    emails: emails.map((email) => ({
      ...email,
      firstQueuedAt: email.firstQueuedAt.toISOString(),
      nextAttemptAt: email.nextAttemptAt.toISOString(),
      lastAttemptAt: email.lastAttemptAt?.toISOString() ?? null,
      sentAt: email.sentAt?.toISOString() ?? null,
      createdAt: email.createdAt.toISOString(),
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}, { route: "/api/admin/outgoing-emails", method: "GET" });

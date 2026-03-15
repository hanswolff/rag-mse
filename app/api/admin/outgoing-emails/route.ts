import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ForbiddenError } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";
import { Permissions } from "@/lib/permissions";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const LOOKBACK_DAYS = 30;
const OUTGOING_EMAIL_SORT_FIELDS = [
  "createdAt",
  "template",
  "subject",
  "toRecipients",
  "status",
  "attemptCount",
  "lastError",
  "lastAttemptAt",
] as const;
type OutgoingEmailSortField = (typeof OUTGOING_EMAIL_SORT_FIELDS)[number];
type OutgoingEmailSortDirection = "asc" | "desc";

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

function parseSortField(value: string | null): OutgoingEmailSortField {
  if (!value) {
    return "createdAt";
  }

  if (OUTGOING_EMAIL_SORT_FIELDS.includes(value as OutgoingEmailSortField)) {
    return value as OutgoingEmailSortField;
  }

  return "createdAt";
}

function parseSortDirection(value: string | null): OutgoingEmailSortDirection {
  return value === "asc" ? "asc" : "desc";
}

function getCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  return cutoff;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth();
  if (!Permissions.canReadOutgoingEmails(user)) {
    throw new ForbiddenError("Keine Berechtigung");
  }

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const skip = (page - 1) * limit;
  const query = (searchParams.get("q") || "").trim();
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortDir = parseSortDirection(searchParams.get("sortDir"));
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
      orderBy: [{ [sortBy]: sortDir }, { id: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        template: true,
        toRecipients: true,
        subject: true,
        textBody: true,
        htmlBody: true,
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

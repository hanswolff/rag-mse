import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ForbiddenError } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";
import { Permissions } from "@/lib/permissions";
import {
  parsePageNumber,
  parsePageSize,
  parseSortField,
  parseSortDirection,
} from "@/lib/api-pagination";

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
  const sortBy = parseSortField(searchParams.get("sortBy"), OUTGOING_EMAIL_SORT_FIELDS, "createdAt");
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

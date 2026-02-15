import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";
import { formatDateForStorage } from "@/lib/date-picker-utils";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function parsePageNumber(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function parsePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function getCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  return cutoff;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const skip = (page - 1) * limit;
  const query = (searchParams.get("q") || "").trim();

  const cutoff = getCutoffDate();

  const where = {
    OR: [
      {
        sentAt: {
          not: null,
          gte: cutoff,
        },
      },
      {
        sentAt: null,
        queuedAt: {
          gte: cutoff,
        },
      },
    ],
    ...(query
      ? {
          user: {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
            ],
          },
        }
      : {}),
  };

  const [dispatches, total] = await Promise.all([
    prisma.eventReminderDispatch.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        sentAt: true,
        queuedAt: true,
        daysBefore: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        event: {
          select: {
            id: true,
            date: true,
            timeFrom: true,
            timeTo: true,
            location: true,
          },
        },
      },
    }),
    prisma.eventReminderDispatch.count({ where }),
  ]);

  const notifications = dispatches.map((dispatch) => ({
    id: dispatch.id,
    sentAt: dispatch.sentAt?.toISOString() ?? null,
    queuedAt: dispatch.queuedAt.toISOString(),
    status: dispatch.sentAt ? "VERSENDET" : "AUSSTEHEND",
    daysBefore: dispatch.daysBefore,
    user: dispatch.user,
    event: {
      ...dispatch.event,
      date: formatDateForStorage(dispatch.event.date),
    },
  }));

  return NextResponse.json({
    notifications,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}, { route: "/api/admin/notifications", method: "GET" });

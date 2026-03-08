import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, ForbiddenError } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";
import { formatDateForStorage } from "@/lib/date-picker-utils";
import { Permissions } from "@/lib/permissions";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const NOTIFICATION_SORT_FIELDS = [
  "sentAt",
  "status",
  "userName",
  "userEmail",
  "eventDate",
  "eventTime",
  "location",
] as const;
type NotificationSortField = (typeof NOTIFICATION_SORT_FIELDS)[number];
type NotificationSortDirection = "asc" | "desc";

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

function parseSortField(value: string | null): NotificationSortField {
  if (!value) {
    return "sentAt";
  }

  if (NOTIFICATION_SORT_FIELDS.includes(value as NotificationSortField)) {
    return value as NotificationSortField;
  }

  return "sentAt";
}

function parseSortDirection(value: string | null): NotificationSortDirection {
  return value === "asc" ? "asc" : "desc";
}

function getOrderBy(sortBy: NotificationSortField, sortDir: NotificationSortDirection): Prisma.EventReminderDispatchOrderByWithRelationInput[] {
  switch (sortBy) {
    case "status":
    case "sentAt":
      return [{ sentAt: sortDir }, { queuedAt: sortDir }, { id: "desc" }];
    case "userName":
      return [{ user: { name: sortDir } }, { user: { email: sortDir } }, { id: "desc" }];
    case "userEmail":
      return [{ user: { email: sortDir } }, { id: "desc" }];
    case "eventDate":
      return [{ event: { date: sortDir } }, { event: { timeFrom: sortDir } }, { id: "desc" }];
    case "eventTime":
      return [{ event: { timeFrom: sortDir } }, { event: { timeTo: sortDir } }, { id: "desc" }];
    case "location":
      return [{ event: { location: sortDir } }, { id: "desc" }];
    default:
      return [{ sentAt: "desc" }, { queuedAt: "desc" }, { id: "desc" }];
  }
}

function getCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  return cutoff;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth();
  if (!Permissions.canReadNotificationsAdmin(user)) {
    throw new ForbiddenError("Keine Berechtigung");
  }

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const skip = (page - 1) * limit;
  const query = (searchParams.get("q") || "").trim();
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortDir = parseSortDirection(searchParams.get("sortDir"));

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
      orderBy: getOrderBy(sortBy, sortDir),
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

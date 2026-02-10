import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateCreateNewsRequest, type CreateNewsRequest } from "@/lib/news-validation";
import { parseJsonBody, withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";

const MAX_PAGE_SIZE = 100;

function parseNewsDate(newsDate: string | undefined): Date {
  if (!newsDate) return new Date();
  return parseIsoDateOnlyToUtcDate(newsDate);
}

function parsePageSize(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parsePageNumber(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"), 50);
  const skip = (page - 1) * limit;

  const [news, total] = await Promise.all([
    prisma.news.findMany({
      orderBy: [{ newsDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.news.count(),
  ]);

  return NextResponse.json({
    news,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}, { route: "/api/admin/news", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin();

  const body = await parseJsonBody<CreateNewsRequest>(request);
  const validation = validateCreateNewsRequest(body);

  if (!validation.isValid) {
    logValidationFailure('/api/admin/news', 'POST', validation.errors);
    return NextResponse.json(
      { error: validation.errors.join(". ") },
      { status: 400 }
    );
  }

  const { title, content, published, newsDate } = body;
  const publishValue = typeof published === "boolean" ? published : true;

  const newNews = await prisma.news.create({
    data: {
      title,
      content,
      newsDate: parseNewsDate(newsDate),
      published: publishValue,
    },
  });

  logInfo('news_created', 'News created', {
    newsId: newNews.id,
    title,
    published: publishValue,
  });

  return NextResponse.json(newNews, { status: 201 });
}, { route: "/api/admin/news", method: "POST" });

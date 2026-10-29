import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateCreateNewsRequest, type CreateNewsRequest } from "@/lib/news-validation";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";

const ROUTE = "/api/admin/news";

const createNewsSchema = {
  title: { type: "string" as const },
  content: { type: "string" as const },
  newsDate: { type: "string" as const },
  published: { type: "boolean" as const, optional: true },
} as const;

function parseNewsDate(newsDate: string | undefined): Date {
  if (!newsDate) return new Date();
  return parseIsoDateOnlyToUtcDate(newsDate);
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin("read");

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
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const body = await parseAndValidateBody<CreateNewsRequest>(request, createNewsSchema, { route: ROUTE, method: "POST" });

  const validation = validateCreateNewsRequest(body);

  if (!validation.isValid) {
    logValidationFailure(ROUTE, 'POST', validation.errors);
    throw new ValidationError(validation.errors, { fieldErrors: validation.fieldErrors });
  }

  const { title, content, published, newsDate } = body;
  const publishValue = typeof published === "boolean" ? published : true;

  const newNews = await prisma.news.create({
    data: {
      title: title.trim(),
      content: content.trim(),
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
}, { route: ROUTE, method: "POST" });

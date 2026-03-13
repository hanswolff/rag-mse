import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateUpdateNewsRequest, type UpdateNewsRequest } from "@/lib/news-validation";
import { parseJsonBody, validateRequestBody, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";

const updateNewsSchema = {
  title: { type: "string" as const, optional: true },
  content: { type: "string" as const, optional: true },
  newsDate: { type: "string" as const, optional: true },
  published: { type: "boolean" as const, optional: true },
} as const;

function parseNewsDate(newsDate: string): Date {
  return parseIsoDateOnlyToUtcDate(newsDate);
}

export const GET = withApiErrorHandling(async (
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/news/[id]">
) => {
  await requireAdmin("read");

  const { id } = await ctx.params;
  const news = await prisma.news.findUnique({
    where: { id },
  });

  if (!news) {
    logResourceNotFound("news", id, "/api/admin/news/[id]", "GET");
    return NextResponse.json({ error: "News nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(news);
}, { route: "/api/admin/news/[id]", method: "GET" });

export const PUT = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/news/[id]">
) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const body = await parseJsonBody<UpdateNewsRequest>(request);

  const bodyValidation = validateRequestBody(body, updateNewsSchema, { route: "/api/admin/news/[id]", method: "PUT" });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const validation = validateUpdateNewsRequest(body);
  if (!validation.isValid) {
    logValidationFailure("/api/admin/news/[id]", "PUT", validation.errors, { newsId: id });
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const existingNews = await prisma.news.findUnique({
    where: { id },
  });
  if (!existingNews) {
    logResourceNotFound("news", id, "/api/admin/news/[id]", "PUT");
    return NextResponse.json({ error: "News nicht gefunden" }, { status: 404 });
  }

  const updatedNews = await prisma.news.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.content !== undefined && { content: String(body.content).trim() }),
      ...(body.newsDate !== undefined && { newsDate: parseNewsDate(body.newsDate) }),
      ...(typeof body.published === "boolean" && { published: body.published }),
    },
  });

  logInfo("news_updated", "News updated", {
    newsId: updatedNews.id,
    title: updatedNews.title,
    published: updatedNews.published,
  });

  return NextResponse.json(updatedNews);
}, { route: "/api/admin/news/[id]", method: "PUT" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/news/[id]">
) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const existingNews = await prisma.news.findUnique({
    where: { id },
  });

  if (!existingNews) {
    logResourceNotFound("news", id, "/api/admin/news/[id]", "DELETE");
    return NextResponse.json({ error: "News nicht gefunden" }, { status: 404 });
  }

  await prisma.news.delete({
    where: { id },
  });

  logInfo("news_deleted", "News deleted", {
    newsId: existingNews.id,
    title: existingNews.title,
  });

  return NextResponse.json({ message: "News erfolgreich gelöscht" });
}, { route: "/api/admin/news/[id]", method: "DELETE" });

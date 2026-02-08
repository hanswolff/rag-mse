import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { validateUpdateNewsRequest, type UpdateNewsRequest } from "@/lib/news-validation";
import { BadRequestError, logApiError, parseJsonBody, validateRequestBody, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";

const updateNewsSchema = {
  title: { type: 'string' as const, optional: true },
  content: { type: 'string' as const, optional: true },
  published: { type: 'boolean' as const, optional: true },
} as const;

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/news/[id]'>
) {
  try {
    await requireAdmin();

    const { id } = await ctx.params;
    const news = await prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      logResourceNotFound('news', id, '/api/admin/news/[id]', 'GET');
      return NextResponse.json(
        { error: "News nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(news);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    logApiError(error, {
      route: "/api/admin/news/[id]",
      method: "GET",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/news/[id]'>
) {
  try {
    validateCsrfHeaders(request);

    await requireAdmin();

    const { id } = await ctx.params;
    const body = await parseJsonBody<UpdateNewsRequest>(request);

    const bodyValidation = validateRequestBody(body as unknown as Record<string, unknown>, updateNewsSchema, { route: '/api/admin/news/[id]', method: 'PUT' });
    if (!bodyValidation.isValid) {
      return NextResponse.json(
        { error: bodyValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const validation = validateUpdateNewsRequest(body);

    if (!validation.isValid) {
      logValidationFailure('/api/admin/news/[id]', 'PUT', validation.errors, { newsId: id });
      return NextResponse.json(
        { error: validation.errors.join(". ") },
        { status: 400 }
      );
    }

    const existingNews = await prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      logResourceNotFound('news', id, '/api/admin/news/[id]', 'PUT');
      return NextResponse.json(
        { error: "News nicht gefunden" },
        { status: 404 }
      );
    }

    const { title, content, published } = body;
    const publishValue = typeof published === "boolean" ? published : undefined;

    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(content !== undefined && { content: String(content).trim() }),
        ...(publishValue !== undefined && { published: publishValue }),
      },
    });

    logInfo('news_updated', 'News updated', {
      newsId: updatedNews.id,
      title: updatedNews.title,
      published: updatedNews.published,
    });

    return NextResponse.json(updatedNews);
  } catch (error: unknown) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    logApiError(error, {
      route: "/api/admin/news/[id]",
      method: "PUT",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/news/[id]'>
) {
  try {
    validateCsrfHeaders(request);

    await requireAdmin();

    const { id } = await ctx.params;
    const existingNews = await prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      logResourceNotFound('news', id, '/api/admin/news/[id]', 'DELETE');
      return NextResponse.json(
        { error: "News nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.news.delete({
      where: { id },
    });

    logInfo('news_deleted', 'News deleted', {
      newsId: existingNews.id,
      title: existingNews.title,
    });

    return NextResponse.json({ message: "News erfolgreich gelöscht" });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    logApiError(error, {
      route: "/api/admin/news/[id]",
      method: "DELETE",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

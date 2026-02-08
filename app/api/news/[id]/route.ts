import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-utils";
import { logResourceNotFound } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/news/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const news = await prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      logResourceNotFound('news', id, '/api/news/[id]', 'GET');
      return NextResponse.json(
        { error: "News nicht gefunden" },
        { status: 404 }
      );
    }

    if (!news.published) {
      logResourceNotFound('news', id, '/api/news/[id]', 'GET', {
        reason: 'news not published',
      });
      return NextResponse.json(
        { error: "News nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(news);
  } catch (error: unknown) {
    logApiError(error, {
      route: "/api/news/[id]",
      method: "GET",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

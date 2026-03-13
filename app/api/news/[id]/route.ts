import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicCacheHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { logResourceNotFound } from "@/lib/logger";

export const GET = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<'/api/news/[id]'>
) => {
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

  return NextResponse.json(news, { headers: getPublicCacheHeaders(60, 600) });
}, { route: "/api/news/[id]", method: "GET" });

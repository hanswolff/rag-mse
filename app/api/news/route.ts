import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicCacheHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { parsePageNumber, parsePageSize } from "@/lib/api-pagination";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"), 10, 50);
  const skip = (page - 1) * limit;

  const [news, total] = await Promise.all([
    prisma.news.findMany({
      where: { published: true },
      orderBy: [{ newsDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.news.count({ where: { published: true } }),
  ]);

  return NextResponse.json({
    news,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  }, { headers: getPublicCacheHeaders(60, 600) });
}, { route: "/api/news", method: "GET" });

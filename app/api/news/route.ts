import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-utils";

const MAX_PAGE_SIZE = 50;

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePageNumber(searchParams.get("page"));
    const limit = parsePageSize(searchParams.get("limit"), 10);
    const skip = (page - 1) * limit;

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where: { published: true },
        orderBy: { createdAt: "desc" },
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
    });
  } catch (error: unknown) {
    logApiError(error, {
      route: "/api/news",
      method: "GET",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis-client";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await getRedisClient().ping();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      checks: {
        database: "ok",
        redis: "ok",
      },
    });
  } catch (error: unknown) {
    logApiError(error, {
      route: "/api/health",
      method: "GET",
      status: 500,
    });
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

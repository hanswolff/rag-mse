import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getNoCacheHeaders, logApiError } from "@/lib/api-utils";
import { logWarn } from "@/lib/logger";
import { runSelfTest } from "@/lib/selftest/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function GET(request: NextRequest) {
  const expectedToken = process.env.SELFTEST_TOKEN?.trim();

  // Fail safe: never expose the self-test when no token is configured.
  if (!expectedToken) {
    return NextResponse.json(
      { status: "error", error: "self-test not configured" },
      { status: 503, headers: getNoCacheHeaders() }
    );
  }

  const providedToken = extractBearerToken(request);
  if (!providedToken || !constantTimeEquals(providedToken, expectedToken)) {
    logWarn("selftest_unauthorized", "Self-test access rejected", {
      route: "/api/selftest",
      hasToken: providedToken !== null,
    });
    return NextResponse.json(
      { status: "error", error: "unauthorized" },
      { status: 401, headers: getNoCacheHeaders() }
    );
  }

  try {
    const report = await runSelfTest();
    return NextResponse.json(report, {
      status: report.status === "error" ? 503 : 200,
      headers: getNoCacheHeaders(),
    });
  } catch (error: unknown) {
    logApiError(error, { route: "/api/selftest", method: "GET", status: 500 });
    return NextResponse.json(
      { status: "error", error: "self-test execution failed", timestamp: new Date().toISOString() },
      { status: 500, headers: getNoCacheHeaders() }
    );
  }
}

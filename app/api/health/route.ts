import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    logApiError(error, {
      route: "/api/health",
      method: "GET",
      status: 500,
    });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

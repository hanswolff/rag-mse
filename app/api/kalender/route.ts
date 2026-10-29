import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, getPublicCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { API_ROUTES } from "@/lib/api-routes";
import { loadCalendar, parseCalendarRange } from "@/lib/calendar-service";

const ROUTE = API_ROUTES.CALENDAR;

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const range = parseCalendarRange(searchParams.get("von"), searchParams.get("bis"));
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const calendar = await loadCalendar(viewer, range);

  return NextResponse.json(calendar, { headers: viewer ? getAuthNoCacheHeaders() : getPublicCacheHeaders() });
}, { route: ROUTE, method: "GET" });

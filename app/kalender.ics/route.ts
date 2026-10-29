import { NextResponse } from "next/server";
import { getPublicCacheControl, withApiErrorHandling } from "@/lib/api-error-handler";
import { buildCalendarFeed } from "@/lib/calendar";
import { loadPublicCalendarFeed } from "@/lib/calendar-service";
import { siteUrl } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async () => {
  const feed = buildCalendarFeed({ ...(await loadPublicCalendarFeed()), baseUrl: siteUrl });
  return new NextResponse(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kalender.ics"',
      "Cache-Control": getPublicCacheControl(),
    },
  });
}, { route: "/kalender.ics", method: "GET" });

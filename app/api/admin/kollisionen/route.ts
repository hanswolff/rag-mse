import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getAuthNoCacheHeaders, withApiErrorHandling } from "@/lib/api-error-handler";
import { API_ROUTES } from "@/lib/api-routes";
import { loadCollisionDay, parseCollisionDayQuery } from "@/lib/collision-service";

const ROUTE = API_ROUTES.ADMIN.COLLISIONS;

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const user = await requireAdmin("read");

  const { searchParams } = new URL(request.url);
  const query = parseCollisionDayQuery(searchParams.get("datum"), searchParams.get("ohneTermin"));
  if ("error" in query) {
    return NextResponse.json({ error: query.error }, { status: 400, headers: getAuthNoCacheHeaders() });
  }

  const collisionDay = await loadCollisionDay({ id: user.id, role: user.role }, query);
  return NextResponse.json(collisionDay, { headers: getAuthNoCacheHeaders() });
}, { route: ROUTE, method: "GET" });

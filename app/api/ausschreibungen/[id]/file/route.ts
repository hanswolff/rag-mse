import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serveAusschreibungFile } from "@/lib/ausschreibung-response";
import { canView } from "@/lib/visibility";
import { getCurrentUser } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { logResourceNotFound } from "@/lib/logger";

const ROUTE = "/api/ausschreibungen/[id]/file";

export const GET = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/ausschreibungen/[id]/file">) => {
  const { id } = await ctx.params;
  const [ausschreibung, user] = await Promise.all([
    prisma.ausschreibung.findUnique({ where: { id } }),
    getCurrentUser(),
  ]);

  // Nicht sichtbar heißt auch unter der direkten URL nicht abrufbar — sonst
  // bliebe ein zurückgezogenes PDF über verschickte Links erreichbar (ADR-0011).
  // Bewusst 404 statt 403: die Existenz einer verborgenen Ausschreibung ist selbst
  // eine Information. Für die Admin-Vorschau gibt es /api/admin/ausschreibungen/[id]/file.
  if (!ausschreibung || !canView(ausschreibung.visibility, Boolean(user))) {
    logResourceNotFound("ausschreibung", id, ROUTE, "GET");
    return NextResponse.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const disposition = searchParams.get("download") === "true" ? "attachment" : "inline";

  return serveAusschreibungFile({
    ausschreibung: {
      id: ausschreibung.id,
      storedFileName: ausschreibung.storedFileName,
      mimeType: ausschreibung.mimeType,
      originalFileName: ausschreibung.originalFileName,
      visibility: ausschreibung.visibility,
    },
    disposition,
    route: ROUTE,
    method: "GET",
  });
}, { route: ROUTE, method: "GET" });

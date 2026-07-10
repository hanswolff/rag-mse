import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serveAusschreibungFile } from "@/lib/ausschreibung-response";
import { withApiErrorHandling } from "@/lib/api-utils";
import { logResourceNotFound } from "@/lib/logger";

const ROUTE = "/api/ausschreibungen/[id]/file";

export const GET = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/ausschreibungen/[id]/file">) => {
  const { id } = await ctx.params;
  const ausschreibung = await prisma.ausschreibung.findUnique({ where: { id } });

  if (!ausschreibung) {
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
    },
    disposition,
    route: ROUTE,
    method: "GET",
  });
}, { route: ROUTE, method: "GET" });

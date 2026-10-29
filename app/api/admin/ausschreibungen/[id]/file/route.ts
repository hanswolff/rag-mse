import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { serveAusschreibungFile } from "@/lib/ausschreibung-response";
import { Visibility } from "@/lib/visibility";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { logResourceNotFound } from "@/lib/logger";

const ROUTE = "/api/admin/ausschreibungen/[id]/file";

// Die öffentliche Datei-Route liefert nicht sichtbare Ausschreibungen als 404 aus.
// Damit ein Administrator ein PDF vor dem Freischalten prüfen und ein
// zurückgezogenes noch einsehen kann, gibt es diese Route (ADR-0011).
export const GET = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/ausschreibungen/[id]/file">) => {
  await requireAdmin("read");

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
      // Im Adminbereich nie cachen, unabhängig von der Stufe der Ausschreibung.
      visibility: Visibility.HIDDEN,
    },
    disposition,
    route: ROUTE,
    method: "GET",
  });
}, { route: ROUTE, method: "GET" });

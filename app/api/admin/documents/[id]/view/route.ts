import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { readDocumentFile } from "@/lib/document-storage";
import { withApiErrorHandling } from "@/lib/api-utils";
import { logResourceNotFound } from "@/lib/logger";

export const GET = withApiErrorHandling(async (_request: Request, ctx: RouteContext<"/api/admin/documents/[id]/view">) => {
  await requireAdmin();

  const { id } = await ctx.params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    logResourceNotFound("document", id, "/api/admin/documents/[id]/view", "GET");
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  const content = await readDocumentFile(document.storedFileName);
  const body = new Uint8Array(content);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": `${body.byteLength}`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
    },
  });
}, { route: "/api/admin/documents/[id]/view", method: "GET" });

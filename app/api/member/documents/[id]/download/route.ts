import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { serveDocumentFile } from "@/lib/document-response";
import { withApiErrorHandling } from "@/lib/api-utils";
import { logResourceNotFound } from "@/lib/logger";
import { DocumentArea } from "@prisma/client";

const ROUTE = "/api/member/documents/[id]/download";

export const GET = withApiErrorHandling(async (_request: Request, ctx: RouteContext<"/api/member/documents/[id]/download">) => {
  await requireMember();

  const { id } = await ctx.params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document || document.area !== DocumentArea.MEMBER) {
    logResourceNotFound("document", id, ROUTE, "GET");
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  return serveDocumentFile({
    document: {
      id: document.id,
      storedFileName: document.storedFileName,
      mimeType: document.mimeType,
      originalFileName: document.originalFileName,
    },
    disposition: "attachment",
    route: ROUTE,
    method: "GET",
  });
}, { route: ROUTE, method: "GET" });

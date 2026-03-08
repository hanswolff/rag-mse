import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import {
  normalizeDirectoryNameForUniqueness,
  parseAndValidateDocumentDirectoryRequest,
} from "@/lib/document-validation";
import { prisma } from "@/lib/prisma";
import { logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { pluralize } from "@/lib/pluralization";

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/document-directories/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const existingDirectory = await prisma.documentDirectory.findUnique({ where: { id }, select: { id: true } });
  if (!existingDirectory) {
    logResourceNotFound("documentDirectory", id, "/api/admin/document-directories/[id]", "PATCH");
    return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
  }

  const rawBody = await parseJsonBody<unknown>(request);
  const parsed = parseAndValidateDocumentDirectoryRequest(rawBody);

  if (!parsed.isValid) {
    logValidationFailure("/api/admin/document-directories/[id]", "PATCH", parsed.errors, { directoryId: id });
    return NextResponse.json({ error: parsed.errors.join(". ") }, { status: 400 });
  }

  try {
    const updated = await prisma.documentDirectory.update({
      where: { id },
      data: {
        name: parsed.data.name,
        nameNormalized: normalizeDirectoryNameForUniqueness(parsed.data.name),
      },
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      documentCount: updated._count.documents,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Ein Verzeichnis mit diesem Namen existiert bereits" }, { status: 409 });
    }
    throw error;
  }
}, { route: "/api/admin/document-directories/[id]", method: "PATCH" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/document-directories/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const existingDirectory = await prisma.documentDirectory.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          documents: true,
        },
      },
    },
  });

  if (!existingDirectory) {
    logResourceNotFound("documentDirectory", id, "/api/admin/document-directories/[id]", "DELETE");
    return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
  }

  if (existingDirectory._count.documents > 0) {
    const documentLabel = pluralize(existingDirectory._count.documents, "Dokument", "Dokumente");
    return NextResponse.json(
      { error: `Verzeichnis ist nicht leer (${existingDirectory._count.documents} ${documentLabel})` },
      { status: 409 },
    );
  }

  const deleteResult = await prisma.documentDirectory.deleteMany({
    where: {
      id,
      documents: {
        none: {},
      },
    },
  });

  if (deleteResult.count === 0) {
    const stillExists = await prisma.documentDirectory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!stillExists) {
      logResourceNotFound("documentDirectory", id, "/api/admin/document-directories/[id]", "DELETE");
      return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Verzeichnis ist nicht leer" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}, { route: "/api/admin/document-directories/[id]", method: "DELETE" });

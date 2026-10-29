import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, ValidationError } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import {
  normalizeDirectoryNameForUniqueness,
  parseAndValidateUpdateDocumentDirectoryRequest,
} from "@/lib/document-validation";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { pluralize } from "@/lib/pluralization";

const ROUTE = "/api/admin/document-directories/[id]";

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/document-directories/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const existingDirectory = await prisma.documentDirectory.findUnique({
    where: { id },
    select: { id: true, area: true },
  });
  if (!existingDirectory) {
    logResourceNotFound("documentDirectory", id, ROUTE, "PATCH");
    return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
  }

  const rawBody = await parseJsonBody<unknown>(request);
  const parsed = parseAndValidateUpdateDocumentDirectoryRequest(rawBody);

  if (!parsed.isValid) {
    logValidationFailure(ROUTE, "PATCH", parsed.errors, { directoryId: id });
    throw new ValidationError(parsed.errors);
  }
  const normalizedName = parsed.data.name;

  try {
    const updated = await prisma.documentDirectory.update({
      where: { id },
      data: {
        name: normalizedName,
        nameNormalized: normalizeDirectoryNameForUniqueness(normalizedName),
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
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Ein Verzeichnis mit diesem Namen existiert bereits" }, { status: 409 });
    }
    throw error;
  }
}, { route: ROUTE, method: "PATCH" });

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
    logResourceNotFound("documentDirectory", id, ROUTE, "DELETE");
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
      logResourceNotFound("documentDirectory", id, ROUTE, "DELETE");
      return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Verzeichnis ist nicht leer" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

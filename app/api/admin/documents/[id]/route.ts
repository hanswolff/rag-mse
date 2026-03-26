import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { deleteDocumentFile, readDocumentFile, restoreDocumentFile } from "@/lib/document-storage";
import {
  normalizeDirectoryId,
  normalizeDocumentDisplayName,
  parseAndValidateUpdateDocumentRequest,
  parseOptionalDocumentDate,
} from "@/lib/document-validation";
import { parseJsonBody, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure, logWarn } from "@/lib/logger";

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/documents/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const rawBody = await parseJsonBody<unknown>(request);

  const bodyValidation = parseAndValidateUpdateDocumentRequest(rawBody);
  if (!bodyValidation.isValid) {
    logValidationFailure("/api/admin/documents/[id]", "PATCH", bodyValidation.errors, { documentId: id });
    return NextResponse.json({ error: bodyValidation.errors.join(". "), fieldErrors: bodyValidation.fieldErrors }, { status: 400 });
  }
  const body = bodyValidation.data;

  const existingDocument = await prisma.document.findUnique({ where: { id } });

  if (!existingDocument) {
    logResourceNotFound("document", id, "/api/admin/documents/[id]", "PATCH");
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  const updateData: {
    displayName?: string;
    documentDate?: Date;
    directoryId?: string | null;
  } = {};

  if (body.displayName !== undefined) {
    updateData.displayName = normalizeDocumentDisplayName(body.displayName);
  }

  if (body.documentDate !== undefined) {
    const parsedDate = parseOptionalDocumentDate(body.documentDate);
    if (parsedDate) {
      updateData.documentDate = parsedDate;
    }
  }

  if (body.directoryId !== undefined) {
    const normalizedDirectoryId = normalizeDirectoryId(body.directoryId);
    if (!normalizedDirectoryId) {
      updateData.directoryId = null;
    } else {
      const existingDirectory = await prisma.documentDirectory.findUnique({
        where: { id: normalizedDirectoryId },
        select: { id: true, area: true },
      });
      if (!existingDirectory) {
        return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
      }
      if (existingDirectory.area !== existingDocument.area) {
        return NextResponse.json({ error: "Verzeichnis gehört nicht zum Dokumentbereich" }, { status: 409 });
      }
      updateData.directoryId = normalizedDirectoryId;
    }
  }

  const updatedDocument = await prisma.document.update({
    where: { id },
    data: updateData,
    include: {
      directory: {
        select: {
          id: true,
          name: true,
        },
      },
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  logInfo("document_updated", "Document updated", {
    documentId: updatedDocument.id,
  });

  return NextResponse.json({
    ...updatedDocument,
    documentDate: updatedDocument.documentDate.toISOString(),
    createdAt: updatedDocument.createdAt.toISOString(),
    updatedAt: updatedDocument.updatedAt.toISOString(),
  });
}, { route: "/api/admin/documents/[id]", method: "PATCH" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/documents/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existingDocument = await prisma.document.findUnique({ where: { id } });
  if (!existingDocument) {
    logResourceNotFound("document", id, "/api/admin/documents/[id]", "DELETE");
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  let backupContent: Buffer | null = null;
  try {
    backupContent = await readDocumentFile(existingDocument.storedFileName);
  } catch {
    backupContent = null;
  }

  await deleteDocumentFile(existingDocument.storedFileName);

  try {
    await prisma.document.delete({ where: { id } });
  } catch (error: unknown) {
    if (backupContent) {
      try {
        await restoreDocumentFile(existingDocument.storedFileName, new Uint8Array(backupContent));
      } catch (restoreError: unknown) {
        logWarn("document_restore_failed", "Failed to restore file after DB delete error", {
          documentId: existingDocument.id,
          storedFileName: existingDocument.storedFileName,
          error: restoreError instanceof Error ? restoreError.message : String(restoreError),
        });
      }
    }
    throw error;
  }

  logInfo("document_deleted", "Document deleted", {
    documentId: existingDocument.id,
    storedFileName: existingDocument.storedFileName,
  });

  return NextResponse.json({ success: true });
}, { route: "/api/admin/documents/[id]", method: "DELETE" });

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { deleteDocumentFile, readDocumentFile, restoreDocumentFile } from "@/lib/document-storage";
import { deleteWithFileBackup } from "@/lib/file-storage";
import {
  normalizeDirectoryId,
  normalizeDocumentDisplayName,
  parseAndValidateUpdateDocumentRequest,
  parseOptionalDocumentDate,
} from "@/lib/document-validation";
import { parseJsonBody, ValidationError } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { serializeDocument } from "@/lib/document-response";

const ROUTE = "/api/admin/documents/[id]";

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/documents/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const rawBody = await parseJsonBody<unknown>(request);

  const bodyValidation = parseAndValidateUpdateDocumentRequest(rawBody);
  if (!bodyValidation.isValid) {
    logValidationFailure(ROUTE, "PATCH", bodyValidation.errors, { documentId: id });
    throw new ValidationError(bodyValidation.errors, { fieldErrors: bodyValidation.fieldErrors });
  }
  const body = bodyValidation.data;

  const existingDocument = await prisma.document.findUnique({ where: { id } });

  if (!existingDocument) {
    logResourceNotFound("document", id, ROUTE, "PATCH");
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

  return NextResponse.json(serializeDocument(updatedDocument));
}, { route: ROUTE, method: "PATCH" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/documents/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existingDocument = await prisma.document.findUnique({ where: { id } });
  if (!existingDocument) {
    logResourceNotFound("document", id, ROUTE, "DELETE");
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  await deleteWithFileBackup({
    storedFileName: existingDocument.storedFileName,
    readFile: readDocumentFile,
    deleteFile: deleteDocumentFile,
    restoreFile: restoreDocumentFile,
    deleteRecord: async () => {
      await prisma.document.delete({ where: { id } });
    },
    restoreFailedLog: {
      action: "document_restore_failed",
      context: { documentId: existingDocument.id },
    },
  });

  logInfo("document_deleted", "Document deleted", {
    documentId: existingDocument.id,
    storedFileName: existingDocument.storedFileName,
  });

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

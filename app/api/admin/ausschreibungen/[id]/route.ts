import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { deleteAusschreibungFile, readAusschreibungFile, restoreAusschreibungFile, writeAusschreibungFile } from "@/lib/ausschreibung-storage";
import { checkUploadContentLength, deleteStoredFileWithRetry, deleteWithFileBackup, readAndSniffUploadedFile, validateUploadFileEntry } from "@/lib/file-storage";
import {
  getMaxAusschreibungUploadSizeLabel,
  isPdfContent,
  MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
  normalizeAusschreibungDescription,
  normalizeAusschreibungTitle,
  parseAndValidateUpdateAusschreibungRequest,
  parseAusschreibungExpiresAt,
} from "@/lib/ausschreibung-validation";
import type { Visibility } from "@/lib/visibility";
import { ValidationError } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { logInfo, logResourceNotFound, logValidationFailure, logWarn } from "@/lib/logger";
import { serializeAusschreibung } from "@/lib/ausschreibung-response";

const ROUTE = "/api/admin/ausschreibungen/[id]";

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/ausschreibungen/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existingAusschreibung = await prisma.ausschreibung.findUnique({ where: { id } });
  if (!existingAusschreibung) {
    logResourceNotFound("ausschreibung", id, ROUTE, "PATCH");
    return NextResponse.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
  }

  const uploadLimits = {
    maxBytes: MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
    maxSizeLabel: getMaxAusschreibungUploadSizeLabel(),
  };
  const contentLengthResponse = checkUploadContentLength(request, uploadLimits);
  if (contentLengthResponse) {
    return contentLengthResponse;
  }

  const formData = await request.formData();
  const titleRaw = formData.get("title");
  const descriptionRaw = formData.get("description");
  const expiresAtRaw = formData.get("expiresAt");
  const visibilityRaw = formData.get("visibility");
  const maybeFile = formData.get("file");

  const metadataInput = {
    ...(typeof titleRaw === "string" ? { title: titleRaw } : {}),
    ...(typeof descriptionRaw === "string" ? { description: descriptionRaw } : {}),
    ...(typeof expiresAtRaw === "string" ? { expiresAt: expiresAtRaw } : {}),
    ...(typeof visibilityRaw === "string" ? { visibility: visibilityRaw } : {}),
  };
  const hasMetadataInput = Object.keys(metadataInput).length > 0;

  if (!hasMetadataInput && !(maybeFile instanceof File)) {
    return NextResponse.json({ error: "Mindestens ein Feld oder eine Datei muss angegeben werden" }, { status: 400 });
  }

  let body: {
    title?: string;
    description?: string | null;
    expiresAt?: string;
    visibility?: Visibility;
  } = {};

  if (hasMetadataInput) {
    const bodyValidation = parseAndValidateUpdateAusschreibungRequest(metadataInput);
    if (!bodyValidation.isValid) {
      logValidationFailure(ROUTE, "PATCH", bodyValidation.errors, { ausschreibungId: id });
      throw new ValidationError(bodyValidation.errors, { fieldErrors: bodyValidation.fieldErrors });
    }
    body = bodyValidation.data;
  }

  let newFile: { storedFileName: string; originalFileName: string; sizeBytes: number } | null = null;

  if (maybeFile instanceof File) {
    const sizeResponse = validateUploadFileEntry(maybeFile, uploadLimits);
    if (sizeResponse) {
      return sizeResponse;
    }

    const sniffed = await readAndSniffUploadedFile(maybeFile, {
      detectMimeType: (content) => (isPdfContent(content) ? "application/pdf" : null),
      unsupportedContentMessage: "Nur PDF-Dateien sind erlaubt",
    });
    if (!sniffed.ok) {
      return sniffed.response;
    }

    const { storedFileName } = await writeAusschreibungFile({ content: sniffed.content });
    newFile = { storedFileName, originalFileName: maybeFile.name, sizeBytes: maybeFile.size };
  }

  const updateData: {
    title?: string;
    description?: string | null;
    expiresAt?: Date;
    visibility?: Visibility;
    originalFileName?: string;
    storedFileName?: string;
    sizeBytes?: number;
  } = {};

  if (body.title !== undefined) {
    updateData.title = normalizeAusschreibungTitle(body.title);
  }
  if (body.description !== undefined) {
    updateData.description = normalizeAusschreibungDescription(body.description);
  }
  if (body.expiresAt !== undefined) {
    updateData.expiresAt = parseAusschreibungExpiresAt(body.expiresAt);
  }
  if (body.visibility !== undefined) {
    updateData.visibility = body.visibility;
  }
  if (newFile) {
    updateData.originalFileName = newFile.originalFileName;
    updateData.storedFileName = newFile.storedFileName;
    updateData.sizeBytes = newFile.sizeBytes;
  }

  try {
    // storedFileName in derselben Transaktion neu lesen: Bei gleichzeitigem
    // PDF-Austausch würde sonst die Datei des anderen Requests unbemerkt verwaisen
    let previousStoredFileName = existingAusschreibung.storedFileName;
    const updatedAusschreibung = await prisma.$transaction(async (tx) => {
      if (newFile) {
        const current = await tx.ausschreibung.findUnique({
          where: { id },
          select: { storedFileName: true },
        });
        if (current) {
          previousStoredFileName = current.storedFileName;
        }
      }
      return tx.ausschreibung.update({
        where: { id },
        data: updateData,
      });
    });

    if (newFile) {
      if (previousStoredFileName !== existingAusschreibung.storedFileName) {
        logWarn("ausschreibung_concurrent_file_replace", "Concurrent file replace detected; deleting the intermediate file", {
          ausschreibungId: id,
          initialStoredFileName: existingAusschreibung.storedFileName,
          replacedStoredFileName: previousStoredFileName,
        });
      }
      const cleanup = await deleteStoredFileWithRetry(deleteAusschreibungFile, previousStoredFileName);
      if (!cleanup.ok) {
        logWarn("ausschreibung_old_file_cleanup_failed", "Failed to delete replaced file after retry", {
          ausschreibungId: id,
          storedFileName: previousStoredFileName,
          error: cleanup.error instanceof Error ? cleanup.error.message : String(cleanup.error),
        });
      }
    }

    logInfo("ausschreibung_updated", "Ausschreibung updated", {
      ausschreibungId: updatedAusschreibung.id,
    });

    return NextResponse.json(serializeAusschreibung(updatedAusschreibung));
  } catch (error: unknown) {
    if (newFile) {
      try {
        await deleteAusschreibungFile(newFile.storedFileName);
      } catch (cleanupError: unknown) {
        logWarn("ausschreibung_new_file_cleanup_failed", "Failed to clean up new file after update error", {
          ausschreibungId: id,
          storedFileName: newFile.storedFileName,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
    throw error;
  }
}, { route: ROUTE, method: "PATCH" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/ausschreibungen/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existingAusschreibung = await prisma.ausschreibung.findUnique({ where: { id } });
  if (!existingAusschreibung) {
    logResourceNotFound("ausschreibung", id, ROUTE, "DELETE");
    return NextResponse.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
  }

  await deleteWithFileBackup({
    storedFileName: existingAusschreibung.storedFileName,
    readFile: readAusschreibungFile,
    deleteFile: deleteAusschreibungFile,
    restoreFile: restoreAusschreibungFile,
    deleteRecord: async () => {
      await prisma.ausschreibung.delete({ where: { id } });
    },
    restoreFailedLog: {
      action: "ausschreibung_restore_failed",
      context: { ausschreibungId: existingAusschreibung.id },
    },
  });

  logInfo("ausschreibung_deleted", "Ausschreibung deleted", {
    ausschreibungId: existingAusschreibung.id,
    storedFileName: existingAusschreibung.storedFileName,
  });

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });

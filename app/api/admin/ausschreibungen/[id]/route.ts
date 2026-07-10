import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { deleteAusschreibungFile, readAusschreibungFile, restoreAusschreibungFile, writeAusschreibungFile } from "@/lib/ausschreibung-storage";
import {
  getMaxAusschreibungUploadSizeLabel,
  isPdfContent,
  MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
  normalizeAusschreibungDescription,
  normalizeAusschreibungTitle,
  parseAndValidateUpdateAusschreibungRequest,
  parseAusschreibungExpiresAt,
} from "@/lib/ausschreibung-validation";
import { validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import { logInfo, logResourceNotFound, logValidationFailure, logWarn } from "@/lib/logger";

export const PATCH = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/ausschreibungen/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existingAusschreibung = await prisma.ausschreibung.findUnique({ where: { id } });
  if (!existingAusschreibung) {
    logResourceNotFound("ausschreibung", id, "/api/admin/ausschreibungen/[id]", "PATCH");
    return NextResponse.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
  }

  const formData = await request.formData();
  const titleRaw = formData.get("title");
  const descriptionRaw = formData.get("description");
  const expiresAtRaw = formData.get("expiresAt");
  const maybeFile = formData.get("file");

  const metadataInput = {
    ...(typeof titleRaw === "string" ? { title: titleRaw } : {}),
    ...(typeof descriptionRaw === "string" ? { description: descriptionRaw } : {}),
    ...(typeof expiresAtRaw === "string" ? { expiresAt: expiresAtRaw } : {}),
  };
  const hasMetadataInput = Object.keys(metadataInput).length > 0;

  if (!hasMetadataInput && !(maybeFile instanceof File)) {
    return NextResponse.json({ error: "Mindestens ein Feld oder eine Datei muss angegeben werden" }, { status: 400 });
  }

  let body: { title?: string; description?: string | null; expiresAt?: string } = {};

  if (hasMetadataInput) {
    const bodyValidation = parseAndValidateUpdateAusschreibungRequest(metadataInput);
    if (!bodyValidation.isValid) {
      logValidationFailure("/api/admin/ausschreibungen/[id]", "PATCH", bodyValidation.errors, { ausschreibungId: id });
      return NextResponse.json({ error: bodyValidation.errors.join(". "), fieldErrors: bodyValidation.fieldErrors }, { status: 400 });
    }
    body = bodyValidation.data;
  }

  let newFile: { storedFileName: string; originalFileName: string; sizeBytes: number } | null = null;

  if (maybeFile instanceof File) {
    if (maybeFile.size <= 0) {
      return NextResponse.json({ error: "Datei ist leer" }, { status: 400 });
    }
    if (maybeFile.size > MAX_AUSSCHREIBUNG_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Datei ist zu groß. Maximal erlaubt: ${getMaxAusschreibungUploadSizeLabel()}` },
        { status: 413 },
      );
    }

    const arrayBuffer = await maybeFile.arrayBuffer();
    const fileContent = new Uint8Array(arrayBuffer);

    if (!isPdfContent(fileContent)) {
      return NextResponse.json({ error: "Nur PDF-Dateien sind erlaubt" }, { status: 400 });
    }

    const { storedFileName } = await writeAusschreibungFile({ content: fileContent });
    newFile = { storedFileName, originalFileName: maybeFile.name, sizeBytes: maybeFile.size };
  }

  const updateData: {
    title?: string;
    description?: string | null;
    expiresAt?: Date;
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
      let cleanupError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await deleteAusschreibungFile(previousStoredFileName);
          cleanupError = null;
          break;
        } catch (error: unknown) {
          cleanupError = error;
        }
      }
      if (cleanupError) {
        logWarn("ausschreibung_old_file_cleanup_failed", "Failed to delete replaced file after retry", {
          ausschreibungId: id,
          storedFileName: previousStoredFileName,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    logInfo("ausschreibung_updated", "Ausschreibung updated", {
      ausschreibungId: updatedAusschreibung.id,
    });

    return NextResponse.json({
      ...updatedAusschreibung,
      expiresAt: updatedAusschreibung.expiresAt.toISOString(),
      createdAt: updatedAusschreibung.createdAt.toISOString(),
      updatedAt: updatedAusschreibung.updatedAt.toISOString(),
    });
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
}, { route: "/api/admin/ausschreibungen/[id]", method: "PATCH" });

export const DELETE = withApiErrorHandling(async (request: NextRequest, ctx: RouteContext<"/api/admin/ausschreibungen/[id]">) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existingAusschreibung = await prisma.ausschreibung.findUnique({ where: { id } });
  if (!existingAusschreibung) {
    logResourceNotFound("ausschreibung", id, "/api/admin/ausschreibungen/[id]", "DELETE");
    return NextResponse.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
  }

  let backupContent: Buffer | null = null;
  try {
    backupContent = await readAusschreibungFile(existingAusschreibung.storedFileName);
  } catch {
    backupContent = null;
  }

  await deleteAusschreibungFile(existingAusschreibung.storedFileName);

  try {
    await prisma.ausschreibung.delete({ where: { id } });
  } catch (error: unknown) {
    if (backupContent) {
      try {
        await restoreAusschreibungFile(existingAusschreibung.storedFileName, new Uint8Array(backupContent));
      } catch (restoreError: unknown) {
        logWarn("ausschreibung_restore_failed", "Failed to restore file after DB delete error", {
          ausschreibungId: existingAusschreibung.id,
          storedFileName: existingAusschreibung.storedFileName,
          error: restoreError instanceof Error ? restoreError.message : String(restoreError),
        });
      }
    }
    throw error;
  }

  logInfo("ausschreibung_deleted", "Ausschreibung deleted", {
    ausschreibungId: existingAusschreibung.id,
    storedFileName: existingAusschreibung.storedFileName,
  });

  return NextResponse.json({ success: true });
}, { route: "/api/admin/ausschreibungen/[id]", method: "DELETE" });

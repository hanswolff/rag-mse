import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import {
  AUSSCHREIBUNG_MIME_TYPE,
  getMaxAusschreibungUploadSizeLabel,
  isPdfContent,
  MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
  normalizeAusschreibungDescription,
  normalizeAusschreibungTitle,
  parseAusschreibungExpiresAt,
  validateCreateAusschreibungMetadata,
} from "@/lib/ausschreibung-validation";
import { deleteAusschreibungFile, writeAusschreibungFile } from "@/lib/ausschreibung-storage";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logValidationFailure, logWarn } from "@/lib/logger";

export const GET = withApiErrorHandling(async () => {
  await requireAdmin("read");

  const ausschreibungen = await prisma.ausschreibung.findMany({
    orderBy: [{ expiresAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json({
    ausschreibungen: ausschreibungen.map((ausschreibung) => ({
      ...ausschreibung,
      expiresAt: ausschreibung.expiresAt.toISOString(),
      createdAt: ausschreibung.createdAt.toISOString(),
      updatedAt: ausschreibung.updatedAt.toISOString(),
    })),
    uploadConstraints: {
      maxUploadMb: Math.floor(MAX_AUSSCHREIBUNG_UPLOAD_BYTES / (1024 * 1024)),
      maxUploadBytes: MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
    },
  });
}, { route: "/api/admin/ausschreibungen", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedContentLength = Number.parseInt(contentLength, 10);
    const multipartOverheadBytes = 1024 * 1024;
    if (Number.isFinite(parsedContentLength) && parsedContentLength > MAX_AUSSCHREIBUNG_UPLOAD_BYTES + multipartOverheadBytes) {
      return NextResponse.json(
        { error: `Datei ist zu groß. Maximal erlaubt: ${getMaxAusschreibungUploadSizeLabel()}` },
        { status: 413 },
      );
    }
  }

  const formData = await request.formData();
  const maybeFile = formData.get("file");

  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ error: "Datei ist erforderlich" }, { status: 400 });
  }

  const file = maybeFile;

  if (file.size <= 0) {
    return NextResponse.json({ error: "Datei ist leer" }, { status: 400 });
  }

  if (file.size > MAX_AUSSCHREIBUNG_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Datei ist zu groß. Maximal erlaubt: ${getMaxAusschreibungUploadSizeLabel()}` },
      { status: 413 },
    );
  }

  const titleRaw = String(formData.get("title") || "");
  const descriptionRaw = formData.get("description");
  const expiresAtRaw = String(formData.get("expiresAt") || "");

  const validation = validateCreateAusschreibungMetadata({
    title: titleRaw,
    description: typeof descriptionRaw === "string" ? descriptionRaw : undefined,
    expiresAt: expiresAtRaw,
  });

  if (!validation.isValid) {
    logValidationFailure("/api/admin/ausschreibungen", "POST", validation.errors);
    return NextResponse.json({ error: validation.errors.join(". "), ...(validation.fieldErrors?.length ? { fieldErrors: validation.fieldErrors } : {}) }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileContent = new Uint8Array(arrayBuffer);

  if (!isPdfContent(fileContent)) {
    return NextResponse.json({ error: "Nur PDF-Dateien sind erlaubt" }, { status: 400 });
  }

  const { storedFileName } = await writeAusschreibungFile({ content: fileContent });

  try {
    const ausschreibung = await prisma.ausschreibung.create({
      data: {
        title: normalizeAusschreibungTitle(titleRaw),
        description: normalizeAusschreibungDescription(typeof descriptionRaw === "string" ? descriptionRaw : null),
        expiresAt: parseAusschreibungExpiresAt(expiresAtRaw),
        originalFileName: file.name,
        storedFileName,
        mimeType: AUSSCHREIBUNG_MIME_TYPE,
        sizeBytes: file.size,
      },
    });

    logInfo("ausschreibung_created", "Ausschreibung created", {
      ausschreibungId: ausschreibung.id,
    });

    return NextResponse.json(
      {
        ...ausschreibung,
        expiresAt: ausschreibung.expiresAt.toISOString(),
        createdAt: ausschreibung.createdAt.toISOString(),
        updatedAt: ausschreibung.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    try {
      await deleteAusschreibungFile(storedFileName);
    } catch (cleanupError: unknown) {
      logWarn("ausschreibung_upload_cleanup_failed", "Failed to clean up file after metadata error", {
        storedFileName,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
    throw error;
  }
}, { route: "/api/admin/ausschreibungen", method: "POST" });

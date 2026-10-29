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
import { parseVisibility } from "@/lib/visibility";
import { deleteAusschreibungFile, writeAusschreibungFile } from "@/lib/ausschreibung-storage";
import { createWithFileRollback, readAndSniffUploadedFile, validateUploadedFile } from "@/lib/file-storage";
import { ValidationError } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { serializeAusschreibung } from "@/lib/ausschreibung-response";

const ROUTE = "/api/admin/ausschreibungen";

export const GET = withApiErrorHandling(async () => {
  await requireAdmin("read");

  const ausschreibungen = await prisma.ausschreibung.findMany({
    orderBy: [{ expiresAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json({
    ausschreibungen: ausschreibungen.map(serializeAusschreibung),
    uploadConstraints: {
      maxUploadMb: Math.floor(MAX_AUSSCHREIBUNG_UPLOAD_BYTES / (1024 * 1024)),
      maxUploadBytes: MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
    },
  });
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const upload = await validateUploadedFile(request, {
    maxBytes: MAX_AUSSCHREIBUNG_UPLOAD_BYTES,
    maxSizeLabel: getMaxAusschreibungUploadSizeLabel(),
  });
  if (!upload.ok) {
    return upload.response;
  }
  const { formData, file } = upload;

  const titleRaw = String(formData.get("title") || "");
  const descriptionRaw = formData.get("description");
  const expiresAtRaw = String(formData.get("expiresAt") || "");
  const visibilityRaw = formData.get("visibility");

  const validation = validateCreateAusschreibungMetadata({
    title: titleRaw,
    description: typeof descriptionRaw === "string" ? descriptionRaw : undefined,
    expiresAt: expiresAtRaw,
    visibility: typeof visibilityRaw === "string" ? visibilityRaw : undefined,
  });

  if (!validation.isValid) {
    logValidationFailure(ROUTE, "POST", validation.errors);
    throw new ValidationError(validation.errors, { fieldErrors: validation.fieldErrors?.length ? validation.fieldErrors : undefined });
  }

  const sniffed = await readAndSniffUploadedFile(file, {
    detectMimeType: (content) => (isPdfContent(content) ? AUSSCHREIBUNG_MIME_TYPE : null),
    unsupportedContentMessage: "Nur PDF-Dateien sind erlaubt",
  });
  if (!sniffed.ok) {
    return sniffed.response;
  }

  // Ohne Angabe bleibt es beim Schema-Default PUBLIC.
  const visibility = typeof visibilityRaw === "string" ? parseVisibility(visibilityRaw) : undefined;

  const { storedFileName } = await writeAusschreibungFile({ content: sniffed.content });

  const ausschreibung = await createWithFileRollback({
    storedFileName,
    deleteFile: deleteAusschreibungFile,
    cleanupFailedLog: { action: "ausschreibung_upload_cleanup_failed" },
    create: () =>
      prisma.ausschreibung.create({
        data: {
          title: normalizeAusschreibungTitle(titleRaw),
          description: normalizeAusschreibungDescription(typeof descriptionRaw === "string" ? descriptionRaw : null),
          expiresAt: parseAusschreibungExpiresAt(expiresAtRaw),
          originalFileName: file.name,
          storedFileName,
          mimeType: AUSSCHREIBUNG_MIME_TYPE,
          sizeBytes: file.size,
          ...(visibility ? { visibility } : {}),
        },
      }),
  });

  logInfo("ausschreibung_created", "Ausschreibung created", {
    ausschreibungId: ausschreibung.id,
  });

  return NextResponse.json(
    serializeAusschreibung(ausschreibung),
    { status: 201 },
  );
}, { route: ROUTE, method: "POST" });

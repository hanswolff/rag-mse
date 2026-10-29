import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  detectAllowedMimeTypeFromContent,
  getAllowedDocumentMimeTypesLabel,
  getCurrentDocumentDate,
  getDefaultDisplayNameFromFileName,
  getMaxDocumentUploadSizeLabel,
  isAllowedDocumentMimeType,
  MAX_DOCUMENT_UPLOAD_BYTES,
  normalizeDirectoryId,
  normalizeDocumentDisplayName,
  parseDocumentArea,
  parseOptionalDocumentDate,
  validateCreateDocumentMetadata,
} from "@/lib/document-validation";
import {
  parsePageNumber,
  parsePageSize,
  parseSortField,
  parseSortDirection,
} from "@/lib/document-query";
import { deleteDocumentFile, writeDocumentFile } from "@/lib/document-storage";
import { createWithFileRollback, readAndSniffUploadedFile, validateUploadedFile } from "@/lib/file-storage";
import { ValidationError } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logValidationFailure, logWarn, maskEmail } from "@/lib/logger";
import { DocumentArea } from "@prisma/client";
import { serializeDocument } from "@/lib/document-response";

const ROUTE = "/api/admin/documents";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin("read");

  const { searchParams } = new URL(request.url);
  const requestedPage = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const query = (searchParams.get("q") || "").trim();
  const directoryParam = (searchParams.get("directory") || "").trim();
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortDir = parseSortDirection(searchParams.get("sortDir"));
  const areaRaw = searchParams.get("area");
  const areaFilter = parseDocumentArea(areaRaw);
  if (areaRaw !== null && !areaFilter) {
    return NextResponse.json({ error: "area muss ADMIN oder MEMBER sein" }, { status: 400 });
  }

  const where: {
    displayName?: { contains: string };
    directoryId?: string | null;
    area?: DocumentArea;
  } = {};

  if (query) {
    where.displayName = { contains: query };
  }

  if (directoryParam === "root") {
    if (!query) {
      where.directoryId = null;
    }
  } else {
    const normalizedDirectoryId = normalizeDirectoryId(directoryParam);
    if (normalizedDirectoryId) {
      where.directoryId = normalizedDirectoryId;
    }
  }

  if (areaFilter) {
    where.area = areaFilter;
  }

  const total = await prisma.document.count({ where: Object.keys(where).length > 0 ? where : undefined });
  const pages = Math.ceil(total / limit);
  const page = pages > 0 ? Math.min(requestedPage, pages) : 1;
  const skip = (page - 1) * limit;

  const documents = await prisma.document.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: [{ [sortBy]: sortDir }, { id: "desc" }],
    skip,
    take: limit,
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

  return NextResponse.json({
    documents: documents.map(serializeDocument),
    pagination: {
      total,
      page,
      limit,
      pages,
    },
    uploadConstraints: {
      maxUploadMb: Math.floor(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024)),
      maxUploadBytes: MAX_DOCUMENT_UPLOAD_BYTES,
      allowedMimeTypes: [...ALLOWED_DOCUMENT_MIME_TYPES],
    },
  });
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin("write");

  const upload = await validateUploadedFile(request, {
    maxBytes: MAX_DOCUMENT_UPLOAD_BYTES,
    maxSizeLabel: getMaxDocumentUploadSizeLabel(),
  });
  if (!upload.ok) {
    return upload.response;
  }
  const { formData, file } = upload;

  const displayNameRaw = String(formData.get("displayName") || "");
  const documentDateRaw = String(formData.get("documentDate") || "");
  const directoryIdRaw = formData.get("directoryId");
  const normalizedDirectoryId = normalizeDirectoryId(typeof directoryIdRaw === "string" ? directoryIdRaw : null);
  const areaFormValue = formData.get("area");
  if (areaFormValue !== null && typeof areaFormValue !== "string") {
    return NextResponse.json({ error: "area muss ADMIN oder MEMBER sein" }, { status: 400 });
  }
  const areaRaw = typeof areaFormValue === "string" ? areaFormValue : null;
  const parsedArea = areaRaw ? parseDocumentArea(areaRaw) : undefined;
  if (areaRaw && !parsedArea) {
    return NextResponse.json({ error: "area muss ADMIN oder MEMBER sein" }, { status: 400 });
  }
  const area = parsedArea ?? DocumentArea.ADMIN;

  const validation = validateCreateDocumentMetadata({
    displayName: displayNameRaw || undefined,
    documentDate: documentDateRaw || undefined,
    directoryId: normalizedDirectoryId,
  });

  if (!validation.isValid) {
    logValidationFailure(ROUTE, "POST", validation.errors);
    throw new ValidationError(validation.errors, { fieldErrors: validation.fieldErrors?.length ? validation.fieldErrors : undefined });
  }

  const displayName = normalizeDocumentDisplayName(
    displayNameRaw || getDefaultDisplayNameFromFileName(file.name),
  );
  const documentDate = parseOptionalDocumentDate(documentDateRaw) || getCurrentDocumentDate();

  if (normalizedDirectoryId) {
    const existingDirectory = await prisma.documentDirectory.findUnique({
      where: { id: normalizedDirectoryId },
      select: { id: true, area: true },
    });
    if (!existingDirectory) {
      return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
    }
    if (existingDirectory.area !== area) {
      return NextResponse.json({ error: "Verzeichnis gehört nicht zum gewählten Bereich" }, { status: 409 });
    }
  }

  const sniffed = await readAndSniffUploadedFile(file, {
    detectMimeType: (content) => {
      const mimeType = detectAllowedMimeTypeFromContent(content);
      return mimeType && isAllowedDocumentMimeType(mimeType) ? mimeType : null;
    },
    unsupportedContentMessage: `Dateiinhalt wird nicht unterstützt. Erlaubt: ${getAllowedDocumentMimeTypesLabel()}`,
  });
  if (!sniffed.ok) {
    return sniffed.response;
  }
  const { content: fileContent, mimeType: sniffedMimeType } = sniffed;

  const { storedFileName } = await writeDocumentFile({
    originalFileName: file.name,
    mimeType: sniffedMimeType,
    content: fileContent,
  });

  try {
    const document = await createWithFileRollback({
      storedFileName,
      deleteFile: deleteDocumentFile,
      cleanupFailedLog: { action: "document_upload_cleanup_failed" },
      create: () =>
        prisma.document.create({
          data: {
            displayName,
            originalFileName: file.name,
            storedFileName,
            mimeType: sniffedMimeType,
            sizeBytes: file.size,
            documentDate,
            area,
            directoryId: normalizedDirectoryId,
            uploadedById: user.id,
          },
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
        }),
    });

    logInfo("document_uploaded", "Document uploaded", {
      documentId: document.id,
      uploadedBy: maskEmail(user.email),
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
    });

    return NextResponse.json(
      serializeDocument(document),
      { status: 201 },
    );
  } catch (error: unknown) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "P2003"
    ) {
      logWarn("document_upload_directory_missing", "Directory was deleted during upload", {
        storedFileName,
        directoryId: normalizedDirectoryId,
      });
      return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 404 });
    }

    logWarn("document_upload_rollback", "Failed to persist metadata after file upload", {
      storedFileName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}, { route: ROUTE, method: "POST" });

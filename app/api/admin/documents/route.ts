import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  detectAllowedMimeTypeFromContent,
  getAllowedDocumentMimeTypesLabel,
  getDefaultDisplayNameFromFileName,
  getMaxDocumentUploadSizeLabel,
  isAllowedDocumentMimeType,
  MAX_DOCUMENT_UPLOAD_BYTES,
  normalizeDocumentDisplayName,
  parseOptionalDocumentDate,
  validateCreateDocumentMetadata,
} from "@/lib/document-validation";
import { deleteDocumentFile, writeDocumentFile } from "@/lib/document-storage";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logValidationFailure, logWarn } from "@/lib/logger";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function parsePageNumber(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

function parsePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, MAX_PAGE_SIZE);
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const requestedPage = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const query = (searchParams.get("q") || "").trim();

  const where = query
    ? {
        displayName: {
          contains: query,
        },
      }
    : undefined;

  const total = await prisma.document.count({ where });
  const pages = Math.ceil(total / limit);
  const page = pages > 0 ? Math.min(requestedPage, pages) : 1;
  const skip = (page - 1) * limit;

  const documents = await prisma.document.findMany({
    where,
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip,
    take: limit,
    include: {
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
    documents: documents.map((document) => ({
      ...document,
      documentDate: document.documentDate.toISOString(),
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })),
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
}, { route: "/api/admin/documents", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  const user = await requireAdmin();

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedContentLength = Number.parseInt(contentLength, 10);
    const multipartOverheadBytes = 1024 * 1024;
    if (Number.isFinite(parsedContentLength) && parsedContentLength > MAX_DOCUMENT_UPLOAD_BYTES + multipartOverheadBytes) {
      return NextResponse.json(
        { error: `Datei ist zu groß. Maximal erlaubt: ${getMaxDocumentUploadSizeLabel()}` },
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

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Datei ist zu groß. Maximal erlaubt: ${getMaxDocumentUploadSizeLabel()}` },
      { status: 413 },
    );
  }

  const displayNameRaw = String(formData.get("displayName") || "");
  const documentDateRaw = String(formData.get("documentDate") || "");

  const validation = validateCreateDocumentMetadata({
    displayName: displayNameRaw || undefined,
    documentDate: documentDateRaw || undefined,
  });

  if (!validation.isValid) {
    logValidationFailure("/api/admin/documents", "POST", validation.errors);
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const displayName = normalizeDocumentDisplayName(
    displayNameRaw || getDefaultDisplayNameFromFileName(file.name),
  );
  const documentDate = parseOptionalDocumentDate(documentDateRaw) || new Date();

  const arrayBuffer = await file.arrayBuffer();
  const fileContent = new Uint8Array(arrayBuffer);
  const sniffedMimeType = detectAllowedMimeTypeFromContent(fileContent);

  if (!sniffedMimeType || !isAllowedDocumentMimeType(sniffedMimeType)) {
    return NextResponse.json(
      { error: `Dateiinhalt wird nicht unterstützt. Erlaubt: ${getAllowedDocumentMimeTypesLabel()}` },
      { status: 400 },
    );
  }

  const { storedFileName } = await writeDocumentFile({
    originalFileName: file.name,
    mimeType: sniffedMimeType,
    content: fileContent,
  });

  try {
    const document = await prisma.document.create({
      data: {
        displayName,
        originalFileName: file.name,
        storedFileName,
        mimeType: sniffedMimeType,
        sizeBytes: file.size,
        documentDate,
        uploadedById: user.id,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logInfo("document_uploaded", "Document uploaded", {
      documentId: document.id,
      uploadedBy: user.email,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
    });

    return NextResponse.json(
      {
        ...document,
        documentDate: document.documentDate.toISOString(),
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    try {
      await deleteDocumentFile(storedFileName);
    } catch (cleanupError: unknown) {
      logWarn("document_upload_cleanup_failed", "Failed to clean up file after metadata error", {
        storedFileName,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    logWarn("document_upload_rollback", "Failed to persist metadata after file upload", {
      storedFileName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}, { route: "/api/admin/documents", method: "POST" });

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
  parseOptionalDocumentDate,
  validateCreateDocumentMetadata,
} from "@/lib/document-validation";
import { deleteDocumentFile, writeDocumentFile } from "@/lib/document-storage";
import { withApiErrorHandling, validateCsrfHeaders } from "@/lib/api-utils";
import { logInfo, logValidationFailure, logWarn } from "@/lib/logger";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const DOCUMENT_SORT_FIELDS = ["displayName", "documentDate", "updatedAt", "mimeType", "sizeBytes"] as const;
type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];
type DocumentSortDirection = "asc" | "desc";

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

function parseSortField(value: string | null): DocumentSortField {
  if (!value) {
    return "documentDate";
  }

  if (DOCUMENT_SORT_FIELDS.includes(value as DocumentSortField)) {
    return value as DocumentSortField;
  }

  return "documentDate";
}

function parseSortDirection(value: string | null): DocumentSortDirection {
  return value === "asc" ? "asc" : "desc";
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin("read");

  const { searchParams } = new URL(request.url);
  const requestedPage = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const query = (searchParams.get("q") || "").trim();
  const directoryParam = (searchParams.get("directory") || "").trim();
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortDir = parseSortDirection(searchParams.get("sortDir"));

  const where: {
    displayName?: { contains: string };
    directoryId?: string | null;
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
  const user = await requireAdmin("write");

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
  const directoryIdRaw = formData.get("directoryId");
  const normalizedDirectoryId = normalizeDirectoryId(typeof directoryIdRaw === "string" ? directoryIdRaw : null);

  const validation = validateCreateDocumentMetadata({
    displayName: displayNameRaw || undefined,
    documentDate: documentDateRaw || undefined,
    directoryId: normalizedDirectoryId,
  });

  if (!validation.isValid) {
    logValidationFailure("/api/admin/documents", "POST", validation.errors);
    return NextResponse.json({ error: validation.errors.join(". ") }, { status: 400 });
  }

  const displayName = normalizeDocumentDisplayName(
    displayNameRaw || getDefaultDisplayNameFromFileName(file.name),
  );
  const documentDate = parseOptionalDocumentDate(documentDateRaw) || getCurrentDocumentDate();

  if (normalizedDirectoryId) {
    const existingDirectory = await prisma.documentDirectory.findUnique({
      where: { id: normalizedDirectoryId },
      select: { id: true },
    });
    if (!existingDirectory) {
      return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 400 });
    }
  }

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
      return NextResponse.json({ error: "Verzeichnis nicht gefunden" }, { status: 400 });
    }

    logWarn("document_upload_rollback", "Failed to persist metadata after file upload", {
      storedFileName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}, { route: "/api/admin/documents", method: "POST" });

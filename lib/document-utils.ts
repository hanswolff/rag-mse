import type { DocumentItem } from "@/types";

export type DirectoryFilter = "root" | string;
export type DocumentSortField = "displayName" | "documentDate" | "updatedAt" | "mimeType" | "sizeBytes";
export type DocumentSortDirection = "asc" | "desc";

export const DOCUMENT_PAGE_SIZE = 20;

export const DOCUMENT_UPLOAD_ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  ".docx",
  ".xlsx",
  ".odt",
  ".ods",
].join(",");

export const DOCUMENT_UPLOAD_FORMATS_LABEL = "PDF, JPG, JPEG, PNG, WEBP, DOCX, XLSX, ODT, ODS";

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isViewableDocument(document: DocumentItem): boolean {
  return document.mimeType === "application/pdf" || document.mimeType.startsWith("image/");
}

export function formatDateForInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const MIME_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF-Dokument",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word-Dokument",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel-Tabelle",
  "application/msword": "Word-Dokument",
  "application/vnd.ms-excel": "Excel-Tabelle",
  "application/vnd.oasis.opendocument.text": "ODT-Dokument",
  "application/vnd.oasis.opendocument.spreadsheet": "ODS-Tabelle",
  "image/jpeg": "JPEG-Bild",
  "image/png": "PNG-Bild",
  "image/webp": "WebP-Bild",
  "image/gif": "GIF-Bild",
  "text/plain": "Textdatei",
  "text/csv": "CSV-Datei",
};

export function getMimeTypeLabel(mimeType: string): string {
  return MIME_TYPE_LABELS[mimeType.toLowerCase()] ?? mimeType;
}

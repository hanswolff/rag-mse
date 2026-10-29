import type { DocumentItem } from "@/types";

export type DirectoryFilter = "root" | string;
export type { DocumentSortField, DocumentSortDirection } from "./document-query";

export const DOCUMENT_PAGE_SIZE = 20;

// Einzige Quelle für erlaubte Formate ist die MIME-Schicht.
export {
  DOCUMENT_FORMATS,
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMATS_LABEL,
} from "./document-mime-detection";

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

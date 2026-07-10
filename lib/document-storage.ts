import path from "node:path";
import { ALLOWED_DOCUMENT_EXTENSIONS } from "@/lib/document-validation";
import { createFileStorage } from "@/lib/file-storage";

const DEFAULT_DOCUMENTS_SUBDIR = path.join("data", "documents");

const ALLOWED_EXTENSIONS = new Set<string>(ALLOWED_DOCUMENT_EXTENSIONS);

function normalizeExtension(extension: string): string {
  const normalized = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ALLOWED_EXTENSIONS.has(normalized)) {
    throw new Error("Ungültige Dateiendung");
  }
  return normalized;
}

function detectExtension(originalFileName: string, mimeType: string): string {
  const fromName = path.extname(originalFileName).replace(".", "").toLowerCase();
  if (fromName && ALLOWED_EXTENSIONS.has(fromName)) {
    return fromName;
  }

  switch (mimeType.toLowerCase()) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    case "application/vnd.oasis.opendocument.text":
      return "odt";
    case "application/vnd.oasis.opendocument.spreadsheet":
      return "ods";
    default:
      throw new Error("Dateityp wird nicht unterstützt");
  }
}

const storage = createFileStorage({
  directoryEnvVar: "DOCUMENTS_DIR",
  defaultSubdir: DEFAULT_DOCUMENTS_SUBDIR,
  validateExtension: (extension) => {
    normalizeExtension(extension);
  },
});

export function getDocumentsDirectory(): string {
  return storage.getDirectory();
}

export async function ensureDocumentsDirectory(): Promise<string> {
  return storage.ensureDirectory();
}

export function getDocumentFilePath(storedFileName: string): string {
  return storage.getFilePath(storedFileName);
}

export async function writeDocumentFile(input: {
  originalFileName: string;
  mimeType: string;
  content: Uint8Array;
}): Promise<{ storedFileName: string; filePath: string }> {
  const extension = detectExtension(input.originalFileName, input.mimeType);
  return storage.writeFile(input.content, extension);
}

export async function readDocumentFile(storedFileName: string): Promise<Buffer> {
  return storage.readFile(storedFileName);
}

export async function deleteDocumentFile(storedFileName: string): Promise<void> {
  return storage.deleteFile(storedFileName);
}

export async function restoreDocumentFile(storedFileName: string, content: Uint8Array): Promise<void> {
  return storage.restoreFile(storedFileName, content);
}

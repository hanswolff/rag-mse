import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { ALLOWED_DOCUMENT_EXTENSIONS } from "@/lib/document-validation";

const DEFAULT_DOCUMENTS_SUBDIR = path.join("data", "documents");

const ALLOWED_EXTENSIONS = new Set<string>(ALLOWED_DOCUMENT_EXTENSIONS);

export function getDocumentsDirectory(): string {
  const configuredDir = process.env.DOCUMENTS_DIR?.trim();
  if (configuredDir) {
    return configuredDir;
  }

  return path.join(process.cwd(), DEFAULT_DOCUMENTS_SUBDIR);
}

export async function ensureDocumentsDirectory(): Promise<string> {
  const directory = getDocumentsDirectory();
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

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
    default:
      throw new Error("Dateityp wird nicht unterstützt");
  }
}

function isSafeStoredFileName(storedFileName: string): boolean {
  return /^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(storedFileName);
}

export function getDocumentFilePath(storedFileName: string): string {
  if (!isSafeStoredFileName(storedFileName)) {
    throw new Error("Ungültiger Dateiname");
  }

  const extension = storedFileName.split(".").pop() || "";
  normalizeExtension(extension);

  return path.join(getDocumentsDirectory(), storedFileName);
}

export async function writeDocumentFile(input: {
  originalFileName: string;
  mimeType: string;
  content: Uint8Array;
}): Promise<{ storedFileName: string; filePath: string }> {
  const directory = await ensureDocumentsDirectory();
  const extension = detectExtension(input.originalFileName, input.mimeType);
  const storedFileName = `${randomUUID().replace(/-/g, "")}.${extension}`;
  const filePath = path.join(directory, storedFileName);

  await fs.writeFile(filePath, input.content);

  return { storedFileName, filePath };
}

export async function readDocumentFile(storedFileName: string): Promise<Buffer> {
  const filePath = getDocumentFilePath(storedFileName);
  return fs.readFile(filePath);
}

export async function deleteDocumentFile(storedFileName: string): Promise<void> {
  const filePath = getDocumentFilePath(storedFileName);
  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

export async function restoreDocumentFile(storedFileName: string, content: Uint8Array): Promise<void> {
  await ensureDocumentsDirectory();
  const filePath = getDocumentFilePath(storedFileName);
  await fs.writeFile(filePath, content);
}

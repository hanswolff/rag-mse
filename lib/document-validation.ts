import { getGermanDateString, parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";
import { validateDateString } from "@/lib/validation-schema";
import { inflateRawSync } from "node:zlib";

const DEFAULT_MAX_DOCUMENT_UPLOAD_MB = 15;

function parseMaxDocumentUploadMb(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_DOCUMENT_UPLOAD_MB;
  }
  return parsed;
}

export const MAX_DOCUMENT_UPLOAD_MB = parseMaxDocumentUploadMb(process.env.DOCUMENT_UPLOAD_MAX_MB);

export const MAX_DOCUMENT_UPLOAD_BYTES = MAX_DOCUMENT_UPLOAD_MB * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
] as const;

const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_DOCUMENT_MIME_TYPES);

export const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "docx", "xlsx", "odt", "ods"] as const;

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ODT_MIME_TYPE = "application/vnd.oasis.opendocument.text";
const ODS_MIME_TYPE = "application/vnd.oasis.opendocument.spreadsheet";

type ZipEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const DOCUMENT_NAME_MAX_LENGTH = 200;
const DIRECTORY_NAME_MAX_LENGTH = 120;

export type UpdateDocumentRequest = {
  displayName?: string;
  documentDate?: string;
  directoryId?: string | null;
};

export type CreateDocumentMetadata = {
  displayName?: string;
  documentDate?: string;
  directoryId?: string | null;
};

export type CreateDocumentDirectoryRequest = {
  name: string;
};

export type ParsedDocumentDirectoryRequest =
  | { isValid: true; data: CreateDocumentDirectoryRequest; errors: [] }
  | { isValid: false; errors: string[] };

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type ParsedUpdateDocumentRequest =
  | { isValid: true; data: UpdateDocumentRequest; errors: [] }
  | { isValid: false; errors: string[] };

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPE_SET.has(mimeType.toLowerCase());
}

export function getAllowedDocumentMimeTypesLabel(): string {
  return "PDF, JPG, JPEG, PNG, WEBP, DOCX, XLSX, ODT, ODS";
}

export function getMaxDocumentUploadSizeLabel(): string {
  return `${MAX_DOCUMENT_UPLOAD_MB} MB`;
}

export function detectAllowedMimeTypeFromContent(content: Uint8Array): string | null {
  if (content.length >= 5) {
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2d];
    if (pdfHeader.every((byte, index) => content[index] === byte)) {
      return "application/pdf";
    }
  }

  if (content.length >= 3) {
    const jpgHeader = [0xff, 0xd8, 0xff];
    if (jpgHeader.every((byte, index) => content[index] === byte)) {
      return "image/jpeg";
    }
  }

  if (content.length >= 8) {
    const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (pngHeader.every((byte, index) => content[index] === byte)) {
      return "image/png";
    }
  }

  if (content.length >= 12) {
    const riffHeader = [0x52, 0x49, 0x46, 0x46];
    const webpHeader = [0x57, 0x45, 0x42, 0x50];
    const hasRiff = riffHeader.every((byte, index) => content[index] === byte);
    const hasWebp = webpHeader.every((byte, index) => content[index + 8] === byte);
    if (hasRiff && hasWebp) {
      return "image/webp";
    }
  }

  const officeMimeType = detectOfficeMimeTypeFromZipContent(content);
  if (officeMimeType) {
    return officeMimeType;
  }

  return null;
}

function readUint16LE(content: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > content.length) {
    return null;
  }
  return content[offset] | (content[offset + 1] << 8);
}

function readUint32LE(content: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > content.length) {
    return null;
  }
  return (
    content[offset] |
    (content[offset + 1] << 8) |
    (content[offset + 2] << 16) |
    (content[offset + 3] << 24)
  ) >>> 0;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function getZipEntries(content: Uint8Array): ZipEntry[] | null {
  if (content.length < 22) {
    return null;
  }

  const maxCommentLength = 0xffff;
  const minStart = Math.max(0, content.length - (22 + maxCommentLength));
  let eocdOffset = -1;

  for (let offset = content.length - 22; offset >= minStart; offset -= 1) {
    const signature = readUint32LE(content, offset);
    if (signature === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    return null;
  }

  const totalEntries = readUint16LE(content, eocdOffset + 10);
  const centralDirectorySize = readUint32LE(content, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LE(content, eocdOffset + 16);
  if (
    totalEntries === null ||
    centralDirectorySize === null ||
    centralDirectoryOffset === null ||
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    return null;
  }

  if (centralDirectoryOffset + centralDirectorySize > content.length) {
    return null;
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    const signature = readUint32LE(content, offset);
    if (signature !== 0x02014b50) {
      return null;
    }

    const compressionMethod = readUint16LE(content, offset + 10);
    const compressedSize = readUint32LE(content, offset + 20);
    const uncompressedSize = readUint32LE(content, offset + 24);
    const fileNameLength = readUint16LE(content, offset + 28);
    const extraFieldLength = readUint16LE(content, offset + 30);
    const fileCommentLength = readUint16LE(content, offset + 32);
    const localHeaderOffset = readUint32LE(content, offset + 42);
    if (
      compressionMethod === null ||
      compressedSize === null ||
      uncompressedSize === null ||
      fileNameLength === null ||
      extraFieldLength === null ||
      fileCommentLength === null ||
      localHeaderOffset === null
    ) {
      return null;
    }

    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > content.length) {
      return null;
    }

    const fileName = decodeUtf8(content.slice(fileNameStart, fileNameEnd));
    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = fileNameEnd + extraFieldLength + fileCommentLength;
    if (offset > content.length) {
      return null;
    }
  }

  return entries;
}

function getZipEntryContent(content: Uint8Array, entry: ZipEntry): Uint8Array | null {
  const localHeaderOffset = entry.localHeaderOffset;
  const signature = readUint32LE(content, localHeaderOffset);
  if (signature !== 0x04034b50) {
    return null;
  }

  const fileNameLength = readUint16LE(content, localHeaderOffset + 26);
  const extraFieldLength = readUint16LE(content, localHeaderOffset + 28);
  if (fileNameLength === null || extraFieldLength === null) {
    return null;
  }

  const compressedDataOffset = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedDataEnd = compressedDataOffset + entry.compressedSize;
  if (compressedDataOffset < 0 || compressedDataEnd > content.length) {
    return null;
  }

  const compressedContent = content.slice(compressedDataOffset, compressedDataEnd);
  if (entry.compressionMethod === 0) {
    return compressedContent;
  }

  if (entry.compressionMethod === 8) {
    try {
      const inflated = inflateRawSync(Buffer.from(compressedContent));
      if (inflated.length === entry.uncompressedSize) {
        return new Uint8Array(inflated);
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

function detectOfficeMimeTypeFromZipContent(content: Uint8Array): string | null {
  if (content.length < 4) {
    return null;
  }

  const signature = readUint32LE(content, 0);
  if (signature !== 0x04034b50) {
    return null;
  }

  const entries = getZipEntries(content);
  if (!entries || entries.length === 0) {
    return null;
  }

  const entryNames = new Set(entries.map((entry) => entry.fileName.toLowerCase()));
  if (entryNames.has("[content_types].xml") && entryNames.has("word/document.xml")) {
    return DOCX_MIME_TYPE;
  }

  if (entryNames.has("[content_types].xml") && entryNames.has("xl/workbook.xml")) {
    return XLSX_MIME_TYPE;
  }

  const mimetypeEntry = entries.find((entry) => entry.fileName.toLowerCase() === "mimetype");
  if (!mimetypeEntry) {
    return null;
  }

  const mimetypeContent = getZipEntryContent(content, mimetypeEntry);
  if (!mimetypeContent) {
    return null;
  }

  const mimetype = decodeUtf8(mimetypeContent).trim();
  if (mimetype === ODT_MIME_TYPE) {
    return ODT_MIME_TYPE;
  }

  if (mimetype === ODS_MIME_TYPE) {
    return ODS_MIME_TYPE;
  }

  return null;
}

export function normalizeDocumentDisplayName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function normalizeDirectoryName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function normalizeDirectoryNameForUniqueness(name: string): string {
  return normalizeDirectoryName(name).toLocaleLowerCase("de-DE");
}

export function normalizeDirectoryId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getDefaultDisplayNameFromFileName(fileName: string): string {
  const cleaned = fileName.trim();
  if (!cleaned) {
    return "Dokument";
  }

  const lastDotIndex = cleaned.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return cleaned;
  }

  return cleaned.slice(0, lastDotIndex);
}

export function parseOptionalDocumentDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return parseIsoDateOnlyToUtcDate(trimmed);
}

export function getCurrentDocumentDate(): Date {
  return parseIsoDateOnlyToUtcDate(getGermanDateString());
}

function validateDisplayName(displayName: string | undefined, errors: string[]): void {
  if (displayName === undefined) {
    return;
  }

  const normalized = normalizeDocumentDisplayName(displayName);
  if (!normalized) {
    errors.push("Dokumentenname darf nicht leer sein");
    return;
  }

  if (normalized.length > DOCUMENT_NAME_MAX_LENGTH) {
    errors.push(`Dokumentenname darf maximal ${DOCUMENT_NAME_MAX_LENGTH} Zeichen lang sein`);
  }
}

function validateDocumentDate(documentDate: string | undefined, errors: string[]): void {
  if (documentDate === undefined) {
    return;
  }

  const trimmed = documentDate.trim();
  if (!trimmed) {
    return;
  }

  if (!validateDateString(trimmed)) {
    errors.push("Ungültiges Dokumentdatum");
  }
}

export function validateDirectoryName(name: string, errors: string[]): void {
  const normalized = normalizeDirectoryName(name);

  if (!normalized) {
    errors.push("Verzeichnisname darf nicht leer sein");
    return;
  }

  if (normalized.length > DIRECTORY_NAME_MAX_LENGTH) {
    errors.push(`Verzeichnisname darf maximal ${DIRECTORY_NAME_MAX_LENGTH} Zeichen lang sein`);
  }

  if (/[\\/]/.test(normalized)) {
    errors.push("Verzeichnisname darf keine Schrägstriche enthalten");
  }
}

function validateDirectoryId(directoryId: string | null | undefined, errors: string[]): void {
  if (directoryId === undefined || directoryId === null) {
    return;
  }

  if (!normalizeDirectoryId(directoryId)) {
    errors.push("directoryId darf nicht leer sein");
  }
}

export function validateCreateDocumentMetadata(data: CreateDocumentMetadata): ValidationResult {
  const errors: string[] = [];
  validateDisplayName(data.displayName, errors);
  validateDocumentDate(data.documentDate, errors);
  validateDirectoryId(data.directoryId, errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUpdateDocumentRequest(data: UpdateDocumentRequest): ValidationResult {
  const errors: string[] = [];

  if (data.displayName === undefined && data.documentDate === undefined && data.directoryId === undefined) {
    errors.push("Mindestens ein Feld muss gesetzt sein");
  }

  validateDisplayName(data.displayName, errors);
  validateDocumentDate(data.documentDate, errors);
  validateDirectoryId(data.directoryId, errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function parseAndValidateUpdateDocumentRequest(input: unknown): ParsedUpdateDocumentRequest {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, errors: ["Ungültiger Request-Body"] };
  }

  const body = input as Record<string, unknown>;
  const allowedKeys = new Set(["displayName", "documentDate", "directoryId"]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unerwartetes Feld: ${key}`);
    }
  }

  const parsed: UpdateDocumentRequest = {};

  if ("displayName" in body) {
    if (typeof body.displayName !== "string") {
      errors.push("displayName muss ein String sein");
    } else {
      parsed.displayName = body.displayName;
    }
  }

  if ("documentDate" in body) {
    if (typeof body.documentDate !== "string") {
      errors.push("documentDate muss ein String sein");
    } else {
      parsed.documentDate = body.documentDate;
    }
  }

  if ("directoryId" in body) {
    if (body.directoryId !== null && typeof body.directoryId !== "string") {
      errors.push("directoryId muss ein String oder null sein");
    } else {
      parsed.directoryId = normalizeDirectoryId(body.directoryId as string | null);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const validation = validateUpdateDocumentRequest(parsed);
  if (!validation.isValid) {
    return { isValid: false, errors: validation.errors };
  }

  return { isValid: true, data: parsed, errors: [] };
}

export function parseAndValidateDocumentDirectoryRequest(input: unknown): ParsedDocumentDirectoryRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, errors: ["Ungültiger Request-Body"] };
  }

  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const allowedKeys = new Set(["name"]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unerwartetes Feld: ${key}`);
    }
  }

  if (typeof body.name !== "string") {
    errors.push("name muss ein String sein");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  validateDirectoryName(body.name as string, errors);
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: { name: normalizeDirectoryName(body.name as string) },
    errors: [],
  };
}

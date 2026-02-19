import { parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";
import { validateDateString } from "@/lib/validation-schema";

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
] as const;

const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_DOCUMENT_MIME_TYPES);

export const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"] as const;

const DOCUMENT_NAME_MAX_LENGTH = 200;

export type UpdateDocumentRequest = {
  displayName?: string;
  documentDate?: string;
};

export type CreateDocumentMetadata = {
  displayName?: string;
  documentDate?: string;
};

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
  return "PDF, JPG, JPEG, PNG, WEBP";
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

  return null;
}

export function normalizeDocumentDisplayName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
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

export function validateCreateDocumentMetadata(data: CreateDocumentMetadata): ValidationResult {
  const errors: string[] = [];
  validateDisplayName(data.displayName, errors);
  validateDocumentDate(data.documentDate, errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUpdateDocumentRequest(data: UpdateDocumentRequest): ValidationResult {
  const errors: string[] = [];

  if (data.displayName === undefined && data.documentDate === undefined) {
    errors.push("Mindestens ein Feld muss gesetzt sein");
  }

  validateDisplayName(data.displayName, errors);
  validateDocumentDate(data.documentDate, errors);

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
  const allowedKeys = new Set(["displayName", "documentDate"]);

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

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const validation = validateUpdateDocumentRequest(parsed);
  if (!validation.isValid) {
    return { isValid: false, errors: validation.errors };
  }

  return { isValid: true, data: parsed, errors: [] };
}

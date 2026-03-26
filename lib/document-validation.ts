import { getGermanDateString, parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";
import { validateDateString } from "@/lib/validation-schema";
import { DocumentArea } from "@prisma/client";
import type { FieldError } from "./server-error-mapper";
import type { ValidationResult } from "./validation-context";

export { detectAllowedMimeTypeFromContent } from "./document-mime-detection";
export type { ValidationResult } from "./validation-context";

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

export function parseDocumentArea(value: string | null): DocumentArea | undefined {
  if (value === "ADMIN") return DocumentArea.ADMIN;
  if (value === "MEMBER") return DocumentArea.MEMBER;
  return undefined;
}

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
  area?: DocumentArea;
};

export type ParsedDocumentDirectoryRequest =
  | { isValid: true; data: CreateDocumentDirectoryRequest; errors: [] }
  | { isValid: false; errors: string[] };

export type UpdateDocumentDirectoryRequest = {
  name: string;
};

export type ParsedUpdateDocumentDirectoryRequest =
  | { isValid: true; data: UpdateDocumentDirectoryRequest; errors: [] }
  | { isValid: false; errors: string[] };


export type ParsedUpdateDocumentRequest =
  | { isValid: true; data: UpdateDocumentRequest; errors: []; fieldErrors?: FieldError[] }
  | { isValid: false; errors: string[]; fieldErrors?: FieldError[] };

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPE_SET.has(mimeType.toLowerCase());
}

export function getAllowedDocumentMimeTypesLabel(): string {
  return "PDF, JPG, JPEG, PNG, WEBP, DOCX, XLSX, ODT, ODS";
}

export function getMaxDocumentUploadSizeLabel(): string {
  return `${MAX_DOCUMENT_UPLOAD_MB} MB`;
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

function validateDisplayName(displayName: string | undefined, errors: string[], fieldErrors?: FieldError[]): void {
  if (displayName === undefined) {
    return;
  }

  const normalized = normalizeDocumentDisplayName(displayName);
  if (!normalized) {
    const msg = "Dokumentenname darf nicht leer sein";
    errors.push(msg);
    fieldErrors?.push({ field: "displayName", message: msg });
    return;
  }

  if (normalized.length > DOCUMENT_NAME_MAX_LENGTH) {
    const msg = `Dokumentenname darf maximal ${DOCUMENT_NAME_MAX_LENGTH} Zeichen lang sein`;
    errors.push(msg);
    fieldErrors?.push({ field: "displayName", message: msg });
  }
}

function validateDocumentDate(documentDate: string | undefined, errors: string[], fieldErrors?: FieldError[]): void {
  if (documentDate === undefined) {
    return;
  }

  const trimmed = documentDate.trim();
  if (!trimmed) {
    return;
  }

  if (!validateDateString(trimmed)) {
    const msg = "Ungültiges Dokumentdatum";
    errors.push(msg);
    fieldErrors?.push({ field: "documentDate", message: msg });
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

function validateDirectoryId(directoryId: string | null | undefined, errors: string[], fieldErrors?: FieldError[]): void {
  if (directoryId === undefined || directoryId === null) {
    return;
  }

  if (!normalizeDirectoryId(directoryId)) {
    const msg = "directoryId darf nicht leer sein";
    errors.push(msg);
    fieldErrors?.push({ field: "directoryId", message: msg });
  }
}

export function validateCreateDocumentMetadata(data: CreateDocumentMetadata): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: FieldError[] = [];
  validateDisplayName(data.displayName, errors, fieldErrors);
  validateDocumentDate(data.documentDate, errors, fieldErrors);
  validateDirectoryId(data.directoryId, errors, fieldErrors);

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function validateUpdateDocumentRequest(data: UpdateDocumentRequest): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: FieldError[] = [];

  if (data.displayName === undefined && data.documentDate === undefined && data.directoryId === undefined) {
    errors.push("Mindestens ein Feld muss gesetzt sein");
  }

  validateDisplayName(data.displayName, errors, fieldErrors);
  validateDocumentDate(data.documentDate, errors, fieldErrors);
  validateDirectoryId(data.directoryId, errors, fieldErrors);

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
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
    return { isValid: false, errors: validation.errors, fieldErrors: validation.fieldErrors };
  }

  return { isValid: true, data: parsed, errors: [] };
}

export function parseAndValidateDocumentDirectoryRequest(input: unknown): ParsedDocumentDirectoryRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, errors: ["Ungültiger Request-Body"] };
  }

  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const allowedKeys = new Set(["name", "area"]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unerwartetes Feld: ${key}`);
    }
  }

  if (typeof body.name !== "string") {
    errors.push("name muss ein String sein");
  }

  if ("area" in body) {
    if (typeof body.area !== "string") {
      errors.push("area muss ein String sein");
    } else if (!parseDocumentArea(body.area)) {
      errors.push("area muss ADMIN oder MEMBER sein");
    }
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
    data: {
      name: normalizeDirectoryName(body.name as string),
      area: typeof body.area === "string" ? parseDocumentArea(body.area) : undefined,
    },
    errors: [],
  };
}

export function parseAndValidateUpdateDocumentDirectoryRequest(input: unknown): ParsedUpdateDocumentDirectoryRequest {
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

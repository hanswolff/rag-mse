import { getGermanDateString, parseIsoDateOnlyToUtcDate } from "@/lib/date-picker-utils";
import { validateDateString } from "@/lib/validation-schema";
import { detectAllowedMimeTypeFromContent } from "@/lib/document-mime-detection";
import type { FieldError } from "./server-error-mapper";
import type { ValidationResult } from "./validation-context";

export type { ValidationResult } from "./validation-context";

const DEFAULT_MAX_AUSSCHREIBUNG_UPLOAD_MB = 15;

function parseMaxAusschreibungUploadMb(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_AUSSCHREIBUNG_UPLOAD_MB;
  }
  return parsed;
}

export const MAX_AUSSCHREIBUNG_UPLOAD_MB = parseMaxAusschreibungUploadMb(process.env.AUSSCHREIBUNG_UPLOAD_MAX_MB);

export const MAX_AUSSCHREIBUNG_UPLOAD_BYTES = MAX_AUSSCHREIBUNG_UPLOAD_MB * 1024 * 1024;

export const AUSSCHREIBUNG_MIME_TYPE = "application/pdf";

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 4000;

export type CreateAusschreibungMetadata = {
  title?: string;
  description?: string | null;
  expiresAt?: string;
};

export type UpdateAusschreibungRequest = {
  title?: string;
  description?: string | null;
  expiresAt?: string;
};

export type ParsedUpdateAusschreibungRequest =
  | { isValid: true; data: UpdateAusschreibungRequest; errors: []; fieldErrors?: FieldError[] }
  | { isValid: false; errors: string[]; fieldErrors?: FieldError[] };

export function isPdfContent(content: Uint8Array): boolean {
  return detectAllowedMimeTypeFromContent(content) === AUSSCHREIBUNG_MIME_TYPE;
}

export function getMaxAusschreibungUploadSizeLabel(): string {
  return `${MAX_AUSSCHREIBUNG_UPLOAD_MB} MB`;
}

export function normalizeAusschreibungTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

export function normalizeAusschreibungDescription(description: string | null | undefined): string | null {
  if (typeof description !== "string") {
    return null;
  }
  const trimmed = description.trim();
  return trimmed ? trimmed : null;
}

export function parseAusschreibungExpiresAt(value: string): Date {
  return parseIsoDateOnlyToUtcDate(value.trim());
}

export function getTodayUtcMidnight(referenceDate: Date = new Date()): Date {
  return parseIsoDateOnlyToUtcDate(getGermanDateString(referenceDate));
}

export function isAusschreibungCurrent(expiresAt: Date, referenceDate: Date = new Date()): boolean {
  return expiresAt.getTime() >= getTodayUtcMidnight(referenceDate).getTime();
}

function validateTitle(title: string | undefined, errors: string[], fieldErrors?: FieldError[]): void {
  if (title === undefined) {
    return;
  }

  const normalized = normalizeAusschreibungTitle(title);
  if (!normalized) {
    const msg = "Titel darf nicht leer sein";
    errors.push(msg);
    fieldErrors?.push({ field: "title", message: msg });
    return;
  }

  if (normalized.length > TITLE_MAX_LENGTH) {
    const msg = `Titel darf maximal ${TITLE_MAX_LENGTH} Zeichen lang sein`;
    errors.push(msg);
    fieldErrors?.push({ field: "title", message: msg });
  }
}

function validateDescriptionField(description: string | null | undefined, errors: string[], fieldErrors?: FieldError[]): void {
  if (description === undefined || description === null) {
    return;
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    const msg = `Beschreibung darf maximal ${DESCRIPTION_MAX_LENGTH} Zeichen lang sein`;
    errors.push(msg);
    fieldErrors?.push({ field: "description", message: msg });
  }
}

function validateExpiresAt(expiresAt: string | undefined, errors: string[], fieldErrors?: FieldError[], required = false): void {
  if (expiresAt === undefined) {
    if (required) {
      const msg = "Ablaufdatum ist erforderlich";
      errors.push(msg);
      fieldErrors?.push({ field: "expiresAt", message: msg });
    }
    return;
  }

  const trimmed = expiresAt.trim();
  if (!trimmed) {
    const msg = "Ablaufdatum ist erforderlich";
    errors.push(msg);
    fieldErrors?.push({ field: "expiresAt", message: msg });
    return;
  }

  if (!validateDateString(trimmed)) {
    const msg = "Ungültiges Ablaufdatum";
    errors.push(msg);
    fieldErrors?.push({ field: "expiresAt", message: msg });
  }
}

export function validateCreateAusschreibungMetadata(data: CreateAusschreibungMetadata): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: FieldError[] = [];

  if (!data.title || !normalizeAusschreibungTitle(data.title)) {
    const msg = "Titel darf nicht leer sein";
    errors.push(msg);
    fieldErrors.push({ field: "title", message: msg });
  } else {
    validateTitle(data.title, errors, fieldErrors);
  }

  validateDescriptionField(data.description, errors, fieldErrors);
  validateExpiresAt(data.expiresAt, errors, fieldErrors, true);

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function parseAndValidateUpdateAusschreibungRequest(input: unknown): ParsedUpdateAusschreibungRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isValid: false, errors: ["Ungültiger Request-Body"] };
  }

  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const allowedKeys = new Set(["title", "description", "expiresAt"]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unerwartetes Feld: ${key}`);
    }
  }

  if (body.title !== undefined && typeof body.title !== "string") {
    errors.push("title muss ein String sein");
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    errors.push("description muss ein String oder null sein");
  }
  if (body.expiresAt !== undefined && typeof body.expiresAt !== "string") {
    errors.push("expiresAt muss ein String sein");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  if (body.title === undefined && body.description === undefined && body.expiresAt === undefined) {
    return { isValid: false, errors: ["Mindestens ein Feld muss gesetzt sein"] };
  }

  const fieldErrors: FieldError[] = [];
  validateTitle(body.title as string | undefined, errors, fieldErrors);
  validateDescriptionField(body.description as string | null | undefined, errors, fieldErrors);
  validateExpiresAt(body.expiresAt as string | undefined, errors, fieldErrors, false);

  if (errors.length > 0) {
    return { isValid: false, errors, fieldErrors };
  }

  const data: UpdateAusschreibungRequest = {};
  if (body.title !== undefined) {
    data.title = normalizeAusschreibungTitle(body.title as string);
  }
  if (body.description !== undefined) {
    data.description = normalizeAusschreibungDescription(body.description as string | null);
  }
  if (body.expiresAt !== undefined) {
    data.expiresAt = (body.expiresAt as string).trim();
  }

  return { isValid: true, data, errors: [] };
}

type AusschreibungListRow = {
  expiresAt: Date;
  createdAt: Date;
};

type SerializedAusschreibung<T extends AusschreibungListRow> = Omit<T, "expiresAt" | "createdAt"> & {
  expiresAt: string;
  createdAt: string;
};

// Gemeinsame Aufteilungs-/Sortierlogik für Seite und API — aktuelle Ausschreibungen
// nach nächstem Meldeschluss zuerst, historische nach jüngstem Meldeschluss zuerst
export function splitAndSortAusschreibungen<T extends AusschreibungListRow>(
  rows: T[],
  now: Date = new Date()
): { current: SerializedAusschreibung<T>[]; historical: SerializedAusschreibung<T>[] } {
  const current: SerializedAusschreibung<T>[] = [];
  const historical: SerializedAusschreibung<T>[] = [];

  for (const row of rows) {
    const item = {
      ...row,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
    if (isAusschreibungCurrent(row.expiresAt, now)) {
      current.push(item);
    } else {
      historical.push(item);
    }
  }

  current.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  historical.sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));

  return { current, historical };
}

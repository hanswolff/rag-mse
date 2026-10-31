import { NextRequest } from "next/server";
import { logValidationFailure } from "@/lib/logger";
import { envInt } from "@/lib/env";

const DEFAULT_MAX_REQUEST_BODY_SIZE = 1048576;
export const MAX_REQUEST_BODY_SIZE = envInt("MAX_REQUEST_BODY_SIZE", DEFAULT_MAX_REQUEST_BODY_SIZE);

export function getMaxSizeMB(maxBytes = MAX_REQUEST_BODY_SIZE): string {
  return (maxBytes / 1024 / 1024).toFixed(1);
}

export class BadRequestError extends Error {
  constructor(message = "Ungültige Anfrage") {
    super(message);
    this.name = "BadRequestError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor(message = "Request-Body zu groß") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export type ValidationFieldError = { field: string; message: string };

/**
 * Wird von withApiErrorHandling zentral auf 400 gemappt. `format: "errors"`
 * liefert `{ errors: [...] }` statt `{ error: "..." }` (Kontaktformular).
 */
export class ValidationError extends Error {
  readonly errors: string[];
  readonly fieldErrors?: ValidationFieldError[];
  readonly format: "error" | "errors";

  constructor(
    errors: string[],
    options: { fieldErrors?: ValidationFieldError[]; format?: "error" | "errors" } = {}
  ) {
    super(errors.join(". "));
    this.name = "ValidationError";
    this.errors = errors;
    this.fieldErrors = options.fieldErrors;
    this.format = options.format ?? "error";
  }

  toResponseBody(): Record<string, unknown> {
    const body: Record<string, unknown> =
      this.format === "errors" ? { errors: this.errors } : { error: this.message };
    if (this.fieldErrors !== undefined) {
      body.fieldErrors = this.fieldErrors;
    }
    return body;
  }
}

export function failValidation(
  routeInfo: { route: string; method: string },
  errors: string[],
  fieldErrors: ValidationFieldError[]
): never {
  logValidationFailure(routeInfo.route, routeInfo.method, errors);
  throw new ValidationError(errors, { fieldErrors });
}

export async function parseJsonBody<T>(request: Request, maxBodySize = MAX_REQUEST_BODY_SIZE): Promise<T> {
  const headers = (request as NextRequest)?.headers || request.headers;
  const contentLength = headers?.get("content-length");
  const maxSizeMB = getMaxSizeMB(maxBodySize);

  if (contentLength) {
    const contentLengthNum = parseInt(contentLength, 10);
    if (contentLengthNum > maxBodySize) {
      throw new PayloadTooLargeError(`Request-Body zu groß (maximal ${maxSizeMB} MB)`);
    }
  }

  try {
    const requestWithClone = request as Request & { clone?: () => Request };
    if (typeof requestWithClone.clone === "function") {
      const requestToRead = requestWithClone.clone();
      let bodyText = "";

      if (requestToRead.body && typeof requestToRead.body.getReader === "function") {
        const reader = requestToRead.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = value ?? new Uint8Array();
          totalBytes += chunk.byteLength;
          if (totalBytes > maxBodySize) {
            await reader.cancel();
            throw new PayloadTooLargeError(`Request-Body zu groß (maximal ${maxSizeMB} MB)`);
          }
          chunks.push(chunk);
        }

        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        bodyText = new TextDecoder().decode(merged);
      } else {
        bodyText = await requestToRead.text();
        const bodySize = new TextEncoder().encode(bodyText).length;
        if (bodySize > maxBodySize) {
          throw new PayloadTooLargeError(`Request-Body zu groß (maximal ${maxSizeMB} MB)`);
        }
      }

      return JSON.parse(bodyText) as T;
    }

    const body = await request.json();
    const bodySize = new TextEncoder().encode(JSON.stringify(body)).length;
    if (bodySize > maxBodySize) {
      throw new PayloadTooLargeError(`Request-Body zu groß (maximal ${maxSizeMB} MB)`);
    }

    return body as T;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      throw error;
    }
    throw new BadRequestError("Ungültiges JSON");
  }
}

export type FieldValidator = (value: unknown) => boolean;

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  optional?: boolean;
  nullable?: boolean;
  validator?: FieldValidator;
}

export type BodySchema = Record<string, FieldDefinition>;

export function validateRequestBody(
  body: unknown,
  schema: BodySchema,
  context: { route: string; method: string }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Ungültiger Request-Body");
    logValidationFailure(context.route, context.method, errors.join("; "));
    return { isValid: false, errors };
  }

  const allowedFields = new Set(Object.keys(schema));

  for (const [key, fieldDef] of Object.entries(schema)) {
    if (fieldDef.optional) continue;
    if (!(key in body)) {
      errors.push(`Pflichtfeld fehlt: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(body)) {
    if (!allowedFields.has(key)) {
      errors.push(`Unerwartetes Feld: ${key}`);
      continue;
    }

    const fieldDef = schema[key];

    if (value === undefined) {
      continue;
    }

    if (value === null) {
      if (!fieldDef.nullable) {
        errors.push(`Feld '${key}' darf nicht null sein`);
      }
      continue;
    }

    const typeError = validateFieldType(key, value, fieldDef.type);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    if (fieldDef.validator && !fieldDef.validator(value)) {
      errors.push(`Ungültiger Wert für Feld '${key}'`);
    }
  }

  if (errors.length > 0) {
    logValidationFailure(context.route, context.method, errors.join("; "));
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function parseAndValidateBody<T>(
  request: Request,
  schema: BodySchema,
  routeInfo: { route: string; method: string }
): Promise<T> {
  const body = await parseJsonBody<T>(request);
  const validation = validateRequestBody(body, schema, routeInfo);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }
  return body;
}

function validateFieldType(key: string, value: unknown, expectedType: FieldDefinition['type']): string | null {
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (actualType === 'object' && value !== null && !Array.isArray(value)) {
    if (expectedType !== 'object') {
      return `Feld '${key}' muss vom Typ ${expectedType} sein, ist aber ein Objekt`;
    }
    return null;
  }

  if (actualType !== expectedType) {
    return `Feld '${key}' muss vom Typ ${expectedType} sein, ist aber ${actualType}`;
  }

  return null;
}

export async function parseCompleteJsonBody<T>(
  request: Request,
  schema: BodySchema,
  routeInfo: { route: string; method: string }
): Promise<T> {
  const body = await parseJsonBody<unknown>(request);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const missing = Object.keys(schema).filter((field) => !schema[field].optional && !(field in body));
    if (missing.length > 0) {
      const fieldErrors = missing.map((field) => ({ field, message: `Pflichtfeld fehlt: ${field}` }));
      const errors = fieldErrors.map((e) => e.message);
      logValidationFailure(routeInfo.route, routeInfo.method, errors);
      throw new ValidationError(errors, { fieldErrors });
    }
  }
  const check = validateRequestBody(body, schema, routeInfo);
  if (!check.isValid) {
    throw new ValidationError(check.errors);
  }
  return body as T;
}

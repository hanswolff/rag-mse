import { NextRequest } from "next/server";
import { logValidationFailure } from "@/lib/logger";

const DEFAULT_MAX_REQUEST_BODY_SIZE = 1048576;
const parsedMaxRequestBodySize = parseInt(process.env.MAX_REQUEST_BODY_SIZE || `${DEFAULT_MAX_REQUEST_BODY_SIZE}`, 10);
export const MAX_REQUEST_BODY_SIZE =
  Number.isFinite(parsedMaxRequestBodySize) && parsedMaxRequestBodySize > 0
    ? parsedMaxRequestBodySize
    : DEFAULT_MAX_REQUEST_BODY_SIZE;

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
  constructor(message = "Request body zu groß") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export async function parseJsonBody<T>(request: Request, maxBodySize = MAX_REQUEST_BODY_SIZE): Promise<T> {
  const headers = (request as NextRequest)?.headers || request.headers;
  const contentLength = headers?.get("content-length");
  const maxSizeMB = getMaxSizeMB(maxBodySize);

  if (contentLength) {
    const contentLengthNum = parseInt(contentLength, 10);
    if (contentLengthNum > maxBodySize) {
      throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
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
            throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
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
          throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
        }
      }

      return JSON.parse(bodyText) as T;
    }

    const body = await request.json();
    const bodySize = new TextEncoder().encode(JSON.stringify(body)).length;
    if (bodySize > maxBodySize) {
      throw new PayloadTooLargeError(`Request body zu groß (maximal ${maxSizeMB} MB)`);
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

import { newsFormSchema } from "./validation-schema";
import { zodToValidationResult } from "./validation-context";
import type { ValidationResult } from "./validation-context";

export { validateTitle, validateContent } from "./validation-schema";
export type { ValidationResult } from "./validation-context";

export interface CreateNewsRequest {
  title: string;
  content: string;
  newsDate?: string;
  published?: boolean;
}

export interface UpdateNewsRequest {
  title?: string;
  content?: string;
  newsDate?: string;
  published?: boolean;
}

export function validateCreateNewsRequest(
  request: CreateNewsRequest
): ValidationResult {
  // Fehlendes newsDate wird zu "" und läuft in die min(1)-Meldung
  // "Datum ist erforderlich" des Schemas — kein separater Vorab-Check nötig.
  return zodToValidationResult(
    newsFormSchema.safeParse({
      newsDate: request.newsDate || "",
      title: request.title,
      content: request.content,
    })
  );
}

export function validateUpdateNewsRequest(
  request: UpdateNewsRequest
): ValidationResult {
  const data: Record<string, string> = {};

  if (request.newsDate !== undefined) data.newsDate = request.newsDate;
  if (request.title !== undefined) data.title = request.title;
  if (request.content !== undefined) data.content = request.content;

  if (Object.keys(data).length === 0) {
    return { isValid: true, errors: [], fieldErrors: [] };
  }

  return zodToValidationResult(newsFormSchema.partial().safeParse(data));
}

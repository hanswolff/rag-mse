import { newsFormSchema } from "./validation-schema";
import { createValidationContext, zodToValidationResult } from "./validation-context";
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
  const ctx = createValidationContext();

  if (!request.newsDate) {
    ctx.addError("newsDate", "Datum ist erforderlich");
  }

  const data = {
    newsDate: request.newsDate || "",
    title: request.title,
    content: request.content,
  };

  const result = newsFormSchema.safeParse(data);

  if (!result.success) {
    for (const issue of result.error.issues) {
      if (!ctx.errors.includes(issue.message)) {
        ctx.errors.push(issue.message);
      }
      if (issue.path.length > 0) {
        const field = String(issue.path[0]);
        if (!ctx.fieldErrors.some((fe) => fe.field === field && fe.message === issue.message)) {
          ctx.fieldErrors.push({ field, message: issue.message });
        }
      }
    }
  }

  return ctx.toResult();
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

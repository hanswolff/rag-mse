import { newsFormSchema } from "./validation-schema";

// Re-export validation functions for backward compatibility with tests
export { validateTitle, validateContent } from "./validation-schema";

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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCreateNewsRequest(
  request: CreateNewsRequest
): ValidationResult {
  const errors: string[] = [];

  // Check for required newsDate first
  if (!request.newsDate) {
    errors.push("Datum ist erforderlich");
  }

  // Validate all fields using Zod schema
  const data = {
    newsDate: request.newsDate || "",
    title: request.title,
    content: request.content,
  };

  const result = newsFormSchema.safeParse(data);

  if (!result.success) {
    // Add Zod errors, avoiding duplicates
    for (const issue of result.error.issues) {
      if (!errors.includes(issue.message)) {
        errors.push(issue.message);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUpdateNewsRequest(
  request: UpdateNewsRequest
): ValidationResult {
  const data: Record<string, string> = {};

  if (request.newsDate !== undefined) data.newsDate = request.newsDate;
  if (request.title !== undefined) data.title = request.title;
  if (request.content !== undefined) data.content = request.content;

  // If no fields to validate, return success
  if (Object.keys(data).length === 0) {
    return { isValid: true, errors: [] };
  }

  const result = newsFormSchema.partial().safeParse(data);

  if (result.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: result.error.issues.map((issue) => issue.message),
  };
}

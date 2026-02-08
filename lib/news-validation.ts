import {
  validateTitle,
  validateContent,
} from "./validation-schema";

// Re-export validation functions for backward compatibility with tests
export { validateTitle, validateContent } from "./validation-schema";

export interface CreateNewsRequest {
  title: string;
  content: string;
  published?: boolean;
}

export interface UpdateNewsRequest {
  title?: string;
  content?: string;
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
  const { title, content } = request;

  if (!title) {
    errors.push("Titel ist erforderlich");
  } else if (!validateTitle(title)) {
    errors.push("Titel muss zwischen 1 und 200 Zeichen lang sein");
  }

  if (!content) {
    errors.push("Inhalt ist erforderlich");
  } else if (!validateContent(content)) {
    errors.push("Inhalt muss zwischen 1 und 10000 Zeichen lang sein");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUpdateNewsRequest(
  request: UpdateNewsRequest
): ValidationResult {
  const errors: string[] = [];
  const { title, content } = request;

  if (title !== undefined) {
    if (title === "" || !validateTitle(title)) {
      errors.push("Titel muss zwischen 1 und 200 Zeichen lang sein");
    }
  }

  if (content !== undefined) {
    if (content === "" || !validateContent(content)) {
      errors.push("Inhalt muss zwischen 1 und 10000 Zeichen lang sein");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

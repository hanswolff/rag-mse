import type { z } from "zod";

export function getFieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError<T>
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "general");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

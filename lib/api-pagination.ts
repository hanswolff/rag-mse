export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type SortDirection = "asc" | "desc";

export function parsePageNumber(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

export function parsePageSize(
  value: string | null,
  fallback = DEFAULT_PAGE_SIZE,
  max = MAX_PAGE_SIZE,
): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

export function parseSortField<T extends string>(
  value: string | null,
  allowedFields: readonly T[],
  defaultField: T,
): T {
  if (!value) return defaultField;
  if ((allowedFields as readonly string[]).includes(value)) return value as T;
  return defaultField;
}

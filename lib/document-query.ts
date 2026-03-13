export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const DOCUMENT_SORT_FIELDS = ["displayName", "documentDate", "updatedAt", "mimeType", "sizeBytes"] as const;
export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];
export type DocumentSortDirection = "asc" | "desc";

export function parsePageNumber(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

export function parsePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, MAX_PAGE_SIZE);
}

export function parseSortField(value: string | null): DocumentSortField {
  if (!value) {
    return "documentDate";
  }

  if (DOCUMENT_SORT_FIELDS.includes(value as DocumentSortField)) {
    return value as DocumentSortField;
  }

  return "documentDate";
}

export function parseSortDirection(value: string | null): DocumentSortDirection {
  return value === "asc" ? "asc" : "desc";
}

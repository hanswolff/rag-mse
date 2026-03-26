export {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  parsePageNumber,
  parsePageSize,
  parseSortDirection,
} from "./api-pagination";
import { parseSortField as genericParseSortField } from "./api-pagination";

export const DOCUMENT_SORT_FIELDS = ["displayName", "documentDate", "updatedAt", "mimeType", "sizeBytes"] as const;
export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];
export type DocumentSortDirection = "asc" | "desc";

export function parseSortField(value: string | null): DocumentSortField {
  return genericParseSortField(value, DOCUMENT_SORT_FIELDS, "documentDate");
}

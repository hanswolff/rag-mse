export function normalizeOptionalText(value?: string | null): string | null {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

export function normalizeCapacity(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
}

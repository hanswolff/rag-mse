export function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function envInt(name: string, defaultValue: number): number {
  return parsePositiveInt(process.env[name]) ?? defaultValue;
}

// Für Werte, bei denen 0 eine gültige Konfiguration ist (z. B. Batchgröße 0 =
// Lauf ohne Verarbeitung).
export function envNonNegativeInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

export function parseUploadLimitMb(envVar: string, defaultMb: number): number {
  return envInt(envVar, defaultMb);
}

export function envBool(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return defaultValue;
}

import { NextResponse } from "next/server";
import { readAusschreibungFile } from "./ausschreibung-storage";
import { serveStoredFile, type DispositionType } from "./file-storage";
import { getAuthNoCacheHeaders } from "./api-error-handler";
import { Visibility } from "./visibility";

export type { DispositionType };

// Ersetzt die Date-Felder in-place (Spread erhält die Schlüsselreihenfolge),
// damit die Response-Bodies byte-identisch zum bisherigen Inline-Mapping bleiben.
export function serializeAusschreibung<T extends { expiresAt: Date; createdAt: Date; updatedAt: Date }>(ausschreibung: T) {
  return {
    ...ausschreibung,
    expiresAt: ausschreibung.expiresAt.toISOString(),
    createdAt: ausschreibung.createdAt.toISOString(),
    updatedAt: ausschreibung.updatedAt.toISOString(),
  };
}

// Ein zurückgezogenes PDF darf nicht minutenlang weiter aus einem Cache fallen:
// die Datei-Route cacht darum deutlich kürzer als die Listen-Antwort, und alles
// Nicht-Öffentliche gar nicht (ADR-0011). `must-revalidate` verbietet zusätzlich
// das Ausliefern abgelaufener Kopien.
function getAusschreibungFileCacheHeaders(visibility: Visibility) {
  if (visibility !== Visibility.PUBLIC) {
    return getAuthNoCacheHeaders();
  }
  return {
    "Cache-Control": "public, max-age=0, s-maxage=30, must-revalidate",
    "Vary": "Cookie",
  };
}

export async function serveAusschreibungFile(options: {
  ausschreibung: {
    id: string;
    storedFileName: string;
    mimeType: string;
    originalFileName: string;
    visibility: Visibility;
  };
  disposition: DispositionType;
  route: string;
  method: string;
}): Promise<NextResponse> {
  return serveStoredFile({
    file: options.ausschreibung,
    disposition: options.disposition,
    route: options.route,
    method: options.method,
    readFile: readAusschreibungFile,
    resourceName: "ausschreibungFile",
    notFoundMessage: "Ausschreibung nicht gefunden",
    logIdKey: "ausschreibungId",
    cacheHeaders: getAusschreibungFileCacheHeaders(options.ausschreibung.visibility),
  });
}

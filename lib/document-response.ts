import { NextResponse } from "next/server";
import { readDocumentFile } from "./document-storage";
import { serveStoredFile, type DispositionType } from "./file-storage";
import { getNoCacheHeaders } from "./api-error-handler";

export type { DispositionType };

// Ersetzt die Date-Felder in-place (Spread erhält die Schlüsselreihenfolge),
// damit die Response-Bodies byte-identisch zum bisherigen Inline-Mapping bleiben.
export function serializeDocument<T extends { documentDate: Date; createdAt: Date; updatedAt: Date }>(document: T) {
  return {
    ...document,
    documentDate: document.documentDate.toISOString(),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function serveDocumentFile(options: {
  document: {
    id: string;
    storedFileName: string;
    mimeType: string;
    originalFileName: string;
  };
  disposition: DispositionType;
  route: string;
  method: string;
}): Promise<NextResponse> {
  return serveStoredFile({
    file: options.document,
    disposition: options.disposition,
    route: options.route,
    method: options.method,
    readFile: readDocumentFile,
    resourceName: "documentFile",
    notFoundMessage: "Dokument nicht gefunden",
    logIdKey: "documentId",
    cacheHeaders: getNoCacheHeaders(),
  });
}

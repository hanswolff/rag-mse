import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { logResourceNotFound, logWarn } from "./logger";

export interface FileStorageConfig {
  directoryEnvVar: string;
  defaultSubdir: string;
  validateExtension: (extension: string) => void;
}

export interface FileStorage {
  getDirectory(): string;
  ensureDirectory(): Promise<string>;
  getFilePath(storedFileName: string): string;
  writeFile(content: Uint8Array, extension: string): Promise<{ storedFileName: string; filePath: string }>;
  readFile(storedFileName: string): Promise<Buffer>;
  deleteFile(storedFileName: string): Promise<void>;
  restoreFile(storedFileName: string, content: Uint8Array): Promise<void>;
  adoptFile(sourcePath: string, extension: string): Promise<{ storedFileName: string; filePath: string } | null>;
}

function isEnoent(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

// turbopackIgnore: Laufzeitpfade, keine Build-Abhängigkeiten. Ohne die Markierung
// traced Next den ganzen Projektbaum (Prod-DB, .git, .env) ins Standalone-Image.
export function createFileStorage(config: FileStorageConfig): FileStorage {
  function getDirectory(): string {
    const configuredDir = process.env[config.directoryEnvVar]?.trim();
    if (configuredDir) {
      return configuredDir;
    }
    return path.join(/* turbopackIgnore: true */ process.cwd(), config.defaultSubdir);
  }

  async function ensureDirectory(): Promise<string> {
    const directory = getDirectory();
    await fs.mkdir(directory, { recursive: true });
    return directory;
  }

  function getFilePath(storedFileName: string): string {
    if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(storedFileName)) {
      throw new Error("Ungültiger Dateiname");
    }
    const extension = storedFileName.split(".").pop() || "";
    config.validateExtension(extension);

    return path.join(/* turbopackIgnore: true */ getDirectory(), storedFileName);
  }

  async function writeFile(content: Uint8Array, extension: string): Promise<{ storedFileName: string; filePath: string }> {
    const directory = await ensureDirectory();
    const storedFileName = `${randomUUID().replace(/-/g, "")}.${extension}`;
    const filePath = path.join(/* turbopackIgnore: true */ directory, storedFileName);

    await fs.writeFile(filePath, content);

    return { storedFileName, filePath };
  }

  async function readFile(storedFileName: string): Promise<Buffer> {
    return fs.readFile(getFilePath(storedFileName));
  }

  async function deleteFile(storedFileName: string): Promise<void> {
    const filePath = getFilePath(storedFileName);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return;
      }
      throw error;
    }
  }

  async function restoreFile(storedFileName: string, content: Uint8Array): Promise<void> {
    await ensureDirectory();
    await fs.writeFile(getFilePath(storedFileName), content);
  }

  async function adoptFile(sourcePath: string, extension: string): Promise<{ storedFileName: string; filePath: string } | null> {
    let sourceStat;
    try {
      sourceStat = await fs.stat(sourcePath);
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return null;
      }
      throw error;
    }
    if (!sourceStat.isFile()) {
      return null;
    }

    const directory = await ensureDirectory();
    const storedFileName = `${randomUUID().replace(/-/g, "")}.${extension}`;
    const filePath = path.join(/* turbopackIgnore: true */ directory, storedFileName);

    await fs.rename(sourcePath, filePath);

    return { storedFileName, filePath };
  }

  return { getDirectory, ensureDirectory, getFilePath, writeFile, readFile, deleteFile, restoreFile, adoptFile };
}

export { parseUploadLimitMb } from "./env";

export type UploadCheckFailure = { ok: false; response: NextResponse };

function fileTooLargeResponse(maxSizeLabel: string): NextResponse {
  return NextResponse.json(
    { error: `Datei ist zu groß. Maximal erlaubt: ${maxSizeLabel}` },
    { status: 413 },
  );
}

// Content-Length-Vorprüfung vor request.formData(): großzügiges 1-MB-Budget für
// Multipart-Overhead, damit gültige Uploads knapp unter dem Limit nicht
// fälschlich abgewiesen werden.
export function checkUploadContentLength(
  request: NextRequest,
  options: { maxBytes: number; maxSizeLabel: string },
): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return null;
  }
  const parsedContentLength = Number.parseInt(contentLength, 10);
  const multipartOverheadBytes = 1024 * 1024;
  if (Number.isFinite(parsedContentLength) && parsedContentLength > options.maxBytes + multipartOverheadBytes) {
    return fileTooLargeResponse(options.maxSizeLabel);
  }
  return null;
}

export function validateUploadFileEntry(
  file: File,
  options: { maxBytes: number; maxSizeLabel: string },
): NextResponse | null {
  if (file.size <= 0) {
    return NextResponse.json({ error: "Datei ist leer" }, { status: 400 });
  }
  if (file.size > options.maxBytes) {
    return fileTooLargeResponse(options.maxSizeLabel);
  }
  return null;
}

// Gemeinsame Upload-Prüfkette: Content-Length-Vorprüfung, Pflichtfeld `file`,
// leer/zu groß. MIME-Sniffing folgt separat (readAndSniffUploadedFile), damit
// Routen ihre Metadaten-Validierung dazwischen behalten können.
export async function validateUploadedFile(
  request: NextRequest,
  options: { maxBytes: number; maxSizeLabel: string; fieldName?: string },
): Promise<{ ok: true; formData: FormData; file: File } | UploadCheckFailure> {
  const contentLengthResponse = checkUploadContentLength(request, options);
  if (contentLengthResponse) {
    return { ok: false, response: contentLengthResponse };
  }

  const formData = await request.formData();
  const maybeFile = formData.get(options.fieldName ?? "file");

  if (!(maybeFile instanceof File)) {
    return { ok: false, response: NextResponse.json({ error: "Datei ist erforderlich" }, { status: 400 }) };
  }

  const sizeResponse = validateUploadFileEntry(maybeFile, options);
  if (sizeResponse) {
    return { ok: false, response: sizeResponse };
  }

  return { ok: true, formData, file: maybeFile };
}

export async function readAndSniffUploadedFile(
  file: File,
  options: {
    detectMimeType: (content: Uint8Array) => string | null;
    unsupportedContentMessage: string;
  },
): Promise<{ ok: true; content: Uint8Array; mimeType: string } | UploadCheckFailure> {
  const arrayBuffer = await file.arrayBuffer();
  const content = new Uint8Array(arrayBuffer);
  const mimeType = options.detectMimeType(content);

  if (!mimeType) {
    return {
      ok: false,
      response: NextResponse.json({ error: options.unsupportedContentMessage }, { status: 400 }),
    };
  }

  return { ok: true, content, mimeType };
}

// Löschen mit einem Wiederholungsversuch: transienten Dateisystem-Fehlern
// (z. B. kurzzeitige Locks) wird einmal erneut begegnet, bevor aufgegeben wird.
export async function deleteStoredFileWithRetry(
  deleteFile: (storedFileName: string) => Promise<void>,
  storedFileName: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await deleteFile(storedFileName);
      return { ok: true };
    } catch (error: unknown) {
      lastError = error;
    }
  }
  return { ok: false, error: lastError };
}

// DB-Datensatz anlegen, nachdem die Datei bereits geschrieben wurde: Schlägt
// die Metadaten-Persistenz fehl, wird die verwaiste Datei aufgeräumt (mit
// Retry) und der Fehler unverändert weitergereicht.
export async function createWithFileRollback<T>(options: {
  storedFileName: string;
  deleteFile: (storedFileName: string) => Promise<void>;
  cleanupFailedLog: { action: string; context?: Record<string, unknown> };
  create: () => Promise<T>;
}): Promise<T> {
  try {
    return await options.create();
  } catch (error: unknown) {
    const cleanup = await deleteStoredFileWithRetry(options.deleteFile, options.storedFileName);
    if (!cleanup.ok) {
      logWarn(options.cleanupFailedLog.action, "Failed to clean up file after metadata error", {
        storedFileName: options.storedFileName,
        ...options.cleanupFailedLog.context,
        error: cleanup.error instanceof Error ? cleanup.error.message : String(cleanup.error),
      });
    }
    throw error;
  }
}

// Datei mit Backup löschen: Inhalt vorher sichern, Datei entfernen, dann den
// DB-Datensatz löschen. Schlägt das DB-Delete fehl, wird die Datei aus dem
// Backup wiederhergestellt.
export async function deleteWithFileBackup(options: {
  storedFileName: string;
  readFile: (storedFileName: string) => Promise<Buffer>;
  deleteFile: (storedFileName: string) => Promise<void>;
  restoreFile: (storedFileName: string, content: Uint8Array) => Promise<void>;
  deleteRecord: () => Promise<void>;
  restoreFailedLog: { action: string; context?: Record<string, unknown> };
}): Promise<void> {
  let backupContent: Buffer | null = null;
  try {
    backupContent = await options.readFile(options.storedFileName);
  } catch {
    backupContent = null;
  }

  await options.deleteFile(options.storedFileName);

  try {
    await options.deleteRecord();
  } catch (error: unknown) {
    if (backupContent) {
      try {
        await options.restoreFile(options.storedFileName, new Uint8Array(backupContent));
      } catch (restoreError: unknown) {
        logWarn(options.restoreFailedLog.action, "Failed to restore file after DB delete error", {
          storedFileName: options.storedFileName,
          ...options.restoreFailedLog.context,
          error: restoreError instanceof Error ? restoreError.message : String(restoreError),
        });
      }
    }
    throw error;
  }
}

export type DispositionType = "inline" | "attachment";

export async function serveStoredFile(options: {
  file: {
    id: string;
    storedFileName: string;
    mimeType: string;
    originalFileName: string;
  };
  disposition: DispositionType;
  route: string;
  method: string;
  readFile: (storedFileName: string) => Promise<Buffer>;
  resourceName: string;
  notFoundMessage: string;
  logIdKey: string;
  cacheHeaders: Record<string, string>;
}): Promise<NextResponse> {
  const { file, disposition, route, method } = options;

  let content: Buffer;
  try {
    content = await options.readFile(file.storedFileName);
  } catch (error: unknown) {
    if (isEnoent(error)) {
      logResourceNotFound(options.resourceName, file.storedFileName, route, method, {
        [options.logIdKey]: file.id,
      });
      return NextResponse.json({ error: options.notFoundMessage }, { status: 404 });
    }
    throw error;
  }

  const body = new Uint8Array(content);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": `${body.byteLength}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
      ...options.cacheHeaders,
    },
  });
}

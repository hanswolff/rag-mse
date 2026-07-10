import path from "node:path";
import { createFileStorage } from "./file-storage";

const DEFAULT_AUSSCHREIBUNGEN_SUBDIR = path.join("data", "ausschreibungen");

const ALLOWED_EXTENSIONS = new Set<string>(["pdf"]);

const storage = createFileStorage({
  directoryEnvVar: "AUSSCHREIBUNGEN_DIR",
  defaultSubdir: DEFAULT_AUSSCHREIBUNGEN_SUBDIR,
  validateExtension: (extension) => {
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Ungültiger Dateiname");
    }
  },
});

export function getAusschreibungenDirectory(): string {
  return storage.getDirectory();
}

export async function ensureAusschreibungenDirectory(): Promise<string> {
  return storage.ensureDirectory();
}

export function getAusschreibungFilePath(storedFileName: string): string {
  return storage.getFilePath(storedFileName);
}

export async function writeAusschreibungFile(input: {
  content: Uint8Array;
}): Promise<{ storedFileName: string; filePath: string }> {
  return storage.writeFile(input.content, "pdf");
}

export async function readAusschreibungFile(storedFileName: string): Promise<Buffer> {
  return storage.readFile(storedFileName);
}

export async function deleteAusschreibungFile(storedFileName: string): Promise<void> {
  return storage.deleteFile(storedFileName);
}

export async function restoreAusschreibungFile(storedFileName: string, content: Uint8Array): Promise<void> {
  return storage.restoreFile(storedFileName, content);
}

export async function adoptAusschreibungFile(sourcePath: string): Promise<{ storedFileName: string; filePath: string } | null> {
  return storage.adoptFile(sourcePath, "pdf");
}

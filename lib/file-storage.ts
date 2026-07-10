import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

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

export function createFileStorage(config: FileStorageConfig): FileStorage {
  function getDirectory(): string {
    const configuredDir = process.env[config.directoryEnvVar]?.trim();
    if (configuredDir) {
      return configuredDir;
    }
    return path.join(process.cwd(), config.defaultSubdir);
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

    return path.join(getDirectory(), storedFileName);
  }

  async function writeFile(content: Uint8Array, extension: string): Promise<{ storedFileName: string; filePath: string }> {
    const directory = await ensureDirectory();
    const storedFileName = `${randomUUID().replace(/-/g, "")}.${extension}`;
    const filePath = path.join(directory, storedFileName);

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
    const filePath = path.join(directory, storedFileName);

    await fs.rename(sourcePath, filePath);

    return { storedFileName, filePath };
  }

  return { getDirectory, ensureDirectory, getFilePath, writeFile, readFile, deleteFile, restoreFile, adoptFile };
}

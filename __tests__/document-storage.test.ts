import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  deleteDocumentFile,
  getDocumentFilePath,
  readDocumentFile,
  restoreDocumentFile,
  writeDocumentFile,
} from "@/lib/document-storage";

describe("document-storage", () => {
  const originalEnv = process.env;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-doc-storage-"));
    process.env = {
      ...originalEnv,
      DOCUMENTS_DIR: tempDir,
    };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writes and reads an allowed document file", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const { storedFileName } = await writeDocumentFile({
      originalFileName: "test.pdf",
      mimeType: "application/pdf",
      content: pdfBytes,
    });

    const loaded = await readDocumentFile(storedFileName);
    expect(Array.from(loaded)).toEqual(Array.from(pdfBytes));
  });

  it("rejects unsafe stored file names", () => {
    expect(() => getDocumentFilePath("../evil.pdf")).toThrow("Ungültiger Dateiname");
  });

  it("ignores delete for missing files", async () => {
    await expect(deleteDocumentFile("missingfile.pdf")).resolves.toBeUndefined();
  });

  it("restores a file with a known safe name", async () => {
    const storedFileName = "abc123def456.pdf";
    const content = new Uint8Array([1, 2, 3, 4]);

    await restoreDocumentFile(storedFileName, content);
    const loaded = await readDocumentFile(storedFileName);
    expect(Array.from(loaded)).toEqual([1, 2, 3, 4]);
  });
});

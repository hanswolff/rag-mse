import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  adoptAusschreibungFile,
  deleteAusschreibungFile,
  getAusschreibungFilePath,
  readAusschreibungFile,
  restoreAusschreibungFile,
  writeAusschreibungFile,
} from "@/lib/ausschreibung-storage";

describe("ausschreibung-storage", () => {
  const originalEnv = process.env;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-ausschreibung-storage-"));
    process.env = {
      ...originalEnv,
      AUSSCHREIBUNGEN_DIR: tempDir,
    };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writes and reads a PDF file with a generated .pdf name", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const { storedFileName } = await writeAusschreibungFile({ content: pdfBytes });

    expect(storedFileName).toMatch(/^[a-f0-9]{32}\.pdf$/);

    const loaded = await readAusschreibungFile(storedFileName);
    expect(Array.from(loaded)).toEqual(Array.from(pdfBytes));
  });

  it("rejects unsafe stored file names", () => {
    expect(() => getAusschreibungFilePath("../evil.pdf")).toThrow("Ungültiger Dateiname");
  });

  it("rejects non-pdf extensions", () => {
    expect(() => getAusschreibungFilePath("abc123.exe")).toThrow("Ungültiger Dateiname");
  });

  it("ignores delete for missing files", async () => {
    await expect(deleteAusschreibungFile("missingfile.pdf")).resolves.toBeUndefined();
  });

  it("restores a file with a known safe name", async () => {
    const storedFileName = "abc123def456.pdf";
    const content = new Uint8Array([1, 2, 3, 4]);

    await restoreAusschreibungFile(storedFileName, content);
    const loaded = await readAusschreibungFile(storedFileName);
    expect(Array.from(loaded)).toEqual([1, 2, 3, 4]);
  });

  describe("adoptAusschreibungFile", () => {
    it("moves an existing source file into the storage directory", async () => {
      const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-ausschreibung-source-"));
      const sourcePath = path.join(sourceDir, "Landesmeisterschaft.pdf");
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      await fs.writeFile(sourcePath, content);

      const adopted = await adoptAusschreibungFile(sourcePath);

      expect(adopted).not.toBeNull();
      expect(adopted?.storedFileName).toMatch(/^[a-f0-9]{32}\.pdf$/);
      await expect(fs.access(sourcePath)).rejects.toThrow();

      const loaded = await readAusschreibungFile(adopted!.storedFileName);
      expect(Array.from(loaded)).toEqual(Array.from(content));

      await fs.rm(sourceDir, { recursive: true, force: true });
    });

    it("returns null and is a no-op when the source file does not exist", async () => {
      const missingPath = path.join(os.tmpdir(), "does-not-exist-ausschreibung.pdf");
      const adopted = await adoptAusschreibungFile(missingPath);
      expect(adopted).toBeNull();
    });
  });
});

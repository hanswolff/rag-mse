describe("document-validation", () => {
  const originalEnv = process.env;
  const encoder = new TextEncoder();

  function pushUint16LE(target: number[], value: number): void {
    target.push(value & 0xff, (value >> 8) & 0xff);
  }

  function pushUint32LE(target: number[], value: number): void {
    target.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  }

  function buildStoredZip(entries: Array<{ name: string; content: string }>): Uint8Array {
    const localFileData: number[] = [];
    const centralDirectoryData: number[] = [];
    let currentOffset = 0;

    const preparedEntries = entries.map((entry) => {
      const fileNameBytes = encoder.encode(entry.name);
      const contentBytes = encoder.encode(entry.content);
      const localHeaderOffset = currentOffset;

      pushUint32LE(localFileData, 0x04034b50);
      pushUint16LE(localFileData, 20);
      pushUint16LE(localFileData, 0);
      pushUint16LE(localFileData, 0);
      pushUint16LE(localFileData, 0);
      pushUint16LE(localFileData, 0);
      pushUint32LE(localFileData, 0);
      pushUint32LE(localFileData, contentBytes.length);
      pushUint32LE(localFileData, contentBytes.length);
      pushUint16LE(localFileData, fileNameBytes.length);
      pushUint16LE(localFileData, 0);
      localFileData.push(...fileNameBytes);
      localFileData.push(...contentBytes);

      currentOffset += 30 + fileNameBytes.length + contentBytes.length;

      return {
        ...entry,
        fileNameBytes,
        contentBytes,
        localHeaderOffset,
      };
    });

    const centralDirectoryOffset = currentOffset;
    for (const entry of preparedEntries) {
      pushUint32LE(centralDirectoryData, 0x02014b50);
      pushUint16LE(centralDirectoryData, 20);
      pushUint16LE(centralDirectoryData, 20);
      pushUint16LE(centralDirectoryData, 0);
      pushUint16LE(centralDirectoryData, 0);
      pushUint16LE(centralDirectoryData, 0);
      pushUint16LE(centralDirectoryData, 0);
      pushUint32LE(centralDirectoryData, 0);
      pushUint32LE(centralDirectoryData, entry.contentBytes.length);
      pushUint32LE(centralDirectoryData, entry.contentBytes.length);
      pushUint16LE(centralDirectoryData, entry.fileNameBytes.length);
      pushUint16LE(centralDirectoryData, 0);
      pushUint16LE(centralDirectoryData, 0);
      pushUint16LE(centralDirectoryData, 0);
      pushUint16LE(centralDirectoryData, 0);
      pushUint32LE(centralDirectoryData, 0);
      pushUint32LE(centralDirectoryData, entry.localHeaderOffset);
      centralDirectoryData.push(...entry.fileNameBytes);
    }

    const eocdData: number[] = [];
    pushUint32LE(eocdData, 0x06054b50);
    pushUint16LE(eocdData, 0);
    pushUint16LE(eocdData, 0);
    pushUint16LE(eocdData, preparedEntries.length);
    pushUint16LE(eocdData, preparedEntries.length);
    pushUint32LE(eocdData, centralDirectoryData.length);
    pushUint32LE(eocdData, centralDirectoryOffset);
    pushUint16LE(eocdData, 0);

    return new Uint8Array([...localFileData, ...centralDirectoryData, ...eocdData]);
  }

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it("falls back to default upload size when env is invalid", async () => {
    process.env = {
      ...originalEnv,
      DOCUMENT_UPLOAD_MAX_MB: "invalid",
    };

    const mod = await import("@/lib/document-validation");

    expect(mod.MAX_DOCUMENT_UPLOAD_MB).toBe(15);
    expect(mod.MAX_DOCUMENT_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
  });

  it("uses configured upload size when env is valid", async () => {
    process.env = {
      ...originalEnv,
      DOCUMENT_UPLOAD_MAX_MB: "20",
    };

    const mod = await import("@/lib/document-validation");

    expect(mod.MAX_DOCUMENT_UPLOAD_MB).toBe(20);
    expect(mod.MAX_DOCUMENT_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
  });

  it("rejects update requests with invalid field types", async () => {
    const mod = await import("@/lib/document-validation");
    const result = mod.parseAndValidateUpdateDocumentRequest({
      displayName: 123,
      documentDate: true,
    });

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors).toContain("displayName muss ein String sein");
      expect(result.errors).toContain("documentDate muss ein String sein");
    }
  });

  it("detects allowed mime type from PDF signature", async () => {
    const mod = await import("@/lib/document-validation");
    const mimeType = mod.detectAllowedMimeTypeFromContent(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
    );

    expect(mimeType).toBe("application/pdf");
  });

  it("detects DOCX mime type from office zip content", async () => {
    const mod = await import("@/lib/document-validation");
    const mimeType = mod.detectAllowedMimeTypeFromContent(
      buildStoredZip([
        { name: "[Content_Types].xml", content: "<Types/>" },
        { name: "word/document.xml", content: "<document/>" },
      ]),
    );

    expect(mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("detects XLSX mime type from office zip content", async () => {
    const mod = await import("@/lib/document-validation");
    const mimeType = mod.detectAllowedMimeTypeFromContent(
      buildStoredZip([
        { name: "[Content_Types].xml", content: "<Types/>" },
        { name: "xl/workbook.xml", content: "<workbook/>" },
      ]),
    );

    expect(mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("detects ODT mime type from libreoffice zip content", async () => {
    const mod = await import("@/lib/document-validation");
    const mimeType = mod.detectAllowedMimeTypeFromContent(
      buildStoredZip([
        { name: "mimetype", content: "application/vnd.oasis.opendocument.text" },
        { name: "content.xml", content: "<office:document-content/>" },
      ]),
    );

    expect(mimeType).toBe("application/vnd.oasis.opendocument.text");
  });

  it("detects ODS mime type from libreoffice zip content", async () => {
    const mod = await import("@/lib/document-validation");
    const mimeType = mod.detectAllowedMimeTypeFromContent(
      buildStoredZip([
        { name: "mimetype", content: "application/vnd.oasis.opendocument.spreadsheet" },
        { name: "content.xml", content: "<office:document-content/>" },
      ]),
    );

    expect(mimeType).toBe("application/vnd.oasis.opendocument.spreadsheet");
  });

  it("rejects generic zip content", async () => {
    const mod = await import("@/lib/document-validation");
    const mimeType = mod.detectAllowedMimeTypeFromContent(
      buildStoredZip([{ name: "notes.txt", content: "hello" }]),
    );

    expect(mimeType).toBeNull();
  });

  it("reports allowed mime labels including office formats", async () => {
    const mod = await import("@/lib/document-validation");
    expect(mod.getAllowedDocumentMimeTypesLabel()).toBe("PDF, JPG, JPEG, PNG, WEBP, DOCX, XLSX, ODT, ODS");
  });

  it("accepts directoryId null in update payload", async () => {
    const mod = await import("@/lib/document-validation");
    const result = mod.parseAndValidateUpdateDocumentRequest({
      directoryId: null,
    });

    expect(result.isValid).toBe(true);
  });

  it("validates directory create payload", async () => {
    const mod = await import("@/lib/document-validation");
    const result = mod.parseAndValidateDocumentDirectoryRequest({
      name: "  Formulare  ",
    });

    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.data.name).toBe("Formulare");
    }
  });
});

describe("document-validation", () => {
  const originalEnv = process.env;

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
});

import {
  formatFileSize,
  isViewableDocument,
  DOCUMENT_PAGE_SIZE,
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMATS_LABEL,
} from "@/lib/document-utils";
import type { DocumentItem } from "@/types";

describe("document-utils", () => {
  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(512)).toBe("512 B");
      expect(formatFileSize(1023)).toBe("1023 B");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(1024 * 1023)).toBe("1023.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
      expect(formatFileSize(1024 * 1024 * 100)).toBe("100.0 MB");
    });
  });

  describe("isViewableDocument", () => {
    const createDocument = (mimeType: string): DocumentItem => ({
      id: "test-id",
      displayName: "Test Document",
      originalFileName: "test.pdf",
      mimeType,
      sizeBytes: 1024,
      documentDate: "2024-01-15T00:00:00.000Z",
      createdAt: "2024-01-15T00:00:00.000Z",
      updatedAt: "2024-01-15T00:00:00.000Z",
    });

    it("returns true for PDF documents", () => {
      expect(isViewableDocument(createDocument("application/pdf"))).toBe(true);
    });

    it("returns true for image types", () => {
      expect(isViewableDocument(createDocument("image/jpeg"))).toBe(true);
      expect(isViewableDocument(createDocument("image/png"))).toBe(true);
      expect(isViewableDocument(createDocument("image/webp"))).toBe(true);
      expect(isViewableDocument(createDocument("image/gif"))).toBe(true);
    });

    it("returns false for non-viewable types", () => {
      expect(isViewableDocument(createDocument("application/msword"))).toBe(false);
      expect(isViewableDocument(createDocument("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe(false);
      expect(isViewableDocument(createDocument("application/zip"))).toBe(false);
      expect(isViewableDocument(createDocument("text/plain"))).toBe(false);
    });
  });

  describe("constants", () => {
    it("DOCUMENT_PAGE_SIZE is 20", () => {
      expect(DOCUMENT_PAGE_SIZE).toBe(20);
    });

    it("DOCUMENT_UPLOAD_ACCEPT contains expected MIME types", () => {
      expect(DOCUMENT_UPLOAD_ACCEPT).toContain("application/pdf");
      expect(DOCUMENT_UPLOAD_ACCEPT).toContain("image/jpeg");
      expect(DOCUMENT_UPLOAD_ACCEPT).toContain("image/png");
    });

    it("DOCUMENT_UPLOAD_FORMATS_LABEL lists expected formats", () => {
      expect(DOCUMENT_UPLOAD_FORMATS_LABEL).toContain("PDF");
      expect(DOCUMENT_UPLOAD_FORMATS_LABEL).toContain("JPG");
      expect(DOCUMENT_UPLOAD_FORMATS_LABEL).toContain("DOCX");
    });
  });
});

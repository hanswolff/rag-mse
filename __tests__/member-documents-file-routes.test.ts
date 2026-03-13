import { GET as GET_VIEW } from "@/app/api/member/documents/[id]/view/route";
import { GET as GET_DOWNLOAD } from "@/app/api/member/documents/[id]/download/route";
import { requireMember } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { readDocumentFile } from "@/lib/document-storage";
import { DocumentArea } from "@prisma/client";

jest.mock("@/lib/auth-utils", () => ({
  requireMember: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/document-storage", () => ({
  readDocumentFile: jest.fn(),
}));

describe("member documents file routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMember as jest.Mock).mockResolvedValue({
      id: "member-1",
      role: "MEMBER",
      email: "member@example.com",
    });
  });

  describe("view route", () => {
    it("returns document with inline disposition for member area documents", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: "doc-1",
        storedFileName: "stored.pdf",
        originalFileName: "satzung.pdf",
        mimeType: "application/pdf",
        area: DocumentArea.MEMBER,
      });
      (readDocumentFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2, 3, 4, 5]));

      const response = await GET_VIEW(new Request("http://localhost:3000/api/member/documents/doc-1/view"), {
        params: Promise.resolve({ id: "doc-1" }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Length")).toBe("5");
      expect(response.headers.get("Content-Disposition")).toContain("inline;");
      expect(response.headers.get("Content-Disposition")).toContain("satzung.pdf");
    });

    it("returns 404 for admin area documents", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: "doc-1",
        storedFileName: "stored.pdf",
        originalFileName: "admin.pdf",
        mimeType: "application/pdf",
        area: DocumentArea.ADMIN,
      });

      const response = await GET_VIEW(new Request("http://localhost:3000/api/member/documents/doc-1/view"), {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Dokument nicht gefunden");
    });

    it("returns 404 for non-existent document", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await GET_VIEW(new Request("http://localhost:3000/api/member/documents/doc-1/view"), {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Dokument nicht gefunden");
    });

    it("returns 404 when file is missing on disk", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: "doc-1",
        storedFileName: "missing.pdf",
        originalFileName: "satzung.pdf",
        mimeType: "application/pdf",
        area: DocumentArea.MEMBER,
      });
      (readDocumentFile as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      const response = await GET_VIEW(new Request("http://localhost:3000/api/member/documents/doc-1/view"), {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Dokument nicht gefunden");
    });
  });

  describe("download route", () => {
    it("returns document with attachment disposition for member area documents", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: "doc-1",
        storedFileName: "stored.pdf",
        originalFileName: "formular.pdf",
        mimeType: "application/pdf",
        area: DocumentArea.MEMBER,
      });
      (readDocumentFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2]));

      const response = await GET_DOWNLOAD(new Request("http://localhost:3000/api/member/documents/doc-1/download"), {
        params: Promise.resolve({ id: "doc-1" }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Length")).toBe("2");
      expect(response.headers.get("Content-Disposition")).toContain("attachment;");
      expect(response.headers.get("Content-Disposition")).toContain("formular.pdf");
    });

    it("returns 404 for admin area documents", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: "doc-1",
        storedFileName: "stored.pdf",
        originalFileName: "admin.pdf",
        mimeType: "application/pdf",
        area: DocumentArea.ADMIN,
      });

      const response = await GET_DOWNLOAD(new Request("http://localhost:3000/api/member/documents/doc-1/download"), {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Dokument nicht gefunden");
    });

    it("returns 404 when file is missing on disk", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: "doc-1",
        storedFileName: "missing.pdf",
        originalFileName: "formular.pdf",
        mimeType: "application/pdf",
        area: DocumentArea.MEMBER,
      });
      (readDocumentFile as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      const response = await GET_DOWNLOAD(new Request("http://localhost:3000/api/member/documents/doc-1/download"), {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Dokument nicht gefunden");
    });
  });
});

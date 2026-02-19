import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/documents/route";
import { PATCH, DELETE } from "@/app/api/admin/documents/[id]/route";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { deleteDocumentFile, readDocumentFile, restoreDocumentFile, writeDocumentFile } from "@/lib/document-storage";

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/document-storage", () => ({
  writeDocumentFile: jest.fn(),
  readDocumentFile: jest.fn(),
  deleteDocumentFile: jest.fn(),
  restoreDocumentFile: jest.fn(),
}));

describe("/api/admin/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("returns paginated documents", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      {
        id: "doc-1",
        displayName: "Antrag 1",
        originalFileName: "antrag.pdf",
        storedFileName: "abc123.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        documentDate: new Date("2026-02-10T00:00:00.000Z"),
        uploadedById: "admin-1",
        createdAt: new Date("2026-02-10T10:00:00.000Z"),
        updatedAt: new Date("2026-02-10T10:00:00.000Z"),
        uploadedBy: {
          id: "admin-1",
          name: "Admin",
          email: "admin@example.com",
        },
      },
    ]);
    (prisma.document.count as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/admin/documents?page=1&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].displayName).toBe("Antrag 1");
    expect(data.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
  });

  it("clamps requested page to last available page", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(21);

    const request = new NextRequest("http://localhost:3000/api/admin/documents?page=5&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination).toEqual({ total: 21, page: 2, limit: 20, pages: 2 });

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.skip).toBe(20);
    expect(findManyCall.take).toBe(20);
  });

  it("uses deterministic ordering for stable pagination", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/documents?page=1&limit=20");
    await GET(request);

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.orderBy).toEqual([
      { documentDate: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("applies search query to document name", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/admin/documents?q=mitglied");
    await GET(request);

    const firstCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where).toEqual({ displayName: { contains: "mitglied" } });
  });

  it("returns validation error when upload has no file", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/documents", { method: "POST" });
    Object.defineProperty(request, "formData", {
      value: async () => new FormData(),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Datei ist erforderlich");
  });

  it("rejects upload when content length exceeds threshold early", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/documents", {
      method: "POST",
      headers: {
        "content-length": `${40 * 1024 * 1024}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.error).toContain("Datei ist zu groß");
  });

  it("rejects upload when file content signature is not allowed", async () => {
    const file = new File([new Uint8Array([0x00, 0x11, 0x22, 0x33])], "antrag.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([0x00, 0x11, 0x22, 0x33]).buffer,
    });

    const formData = new FormData();
    formData.append("file", file);

    const request = new NextRequest("http://localhost:3000/api/admin/documents", { method: "POST" });
    Object.defineProperty(request, "formData", {
      value: async () => formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Dateiinhalt wird nicht unterstützt");
    expect(writeDocumentFile).not.toHaveBeenCalled();
  });

  it("cleans up uploaded file when metadata write fails", async () => {
    (writeDocumentFile as jest.Mock).mockResolvedValue({
      storedFileName: "stored-file.pdf",
      filePath: "/tmp/stored-file.pdf",
    });
    (prisma.document.create as jest.Mock).mockRejectedValue(new Error("DB write failed"));

    const fileBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const file = new File([fileBytes], "antrag.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => fileBytes.buffer,
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("displayName", "Testdokument");

    const request = new NextRequest("http://localhost:3000/api/admin/documents", { method: "POST" });
    Object.defineProperty(request, "formData", {
      value: async () => formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(deleteDocumentFile).toHaveBeenCalledWith("stored-file.pdf");
  });
});

describe("/api/admin/documents/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("updates document metadata", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: "doc-1",
      displayName: "Alt",
      documentDate: new Date("2026-02-10T00:00:00.000Z"),
    });
    (prisma.document.update as jest.Mock).mockResolvedValue({
      id: "doc-1",
      displayName: "Neu",
      originalFileName: "antrag.pdf",
      storedFileName: "abc123.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      documentDate: new Date("2026-02-12T00:00:00.000Z"),
      uploadedById: "admin-1",
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
      updatedAt: new Date("2026-02-12T10:00:00.000Z"),
      uploadedBy: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
      },
    });

    const request = new NextRequest("http://localhost:3000/api/admin/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Neu", documentDate: "2026-02-12" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.displayName).toBe("Neu");
    expect(prisma.document.update).toHaveBeenCalled();
  });

  it("returns validation error when patch payload types are invalid", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ displayName: 123, documentDate: true }),
      headers: { "content-type": "application/json" },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("displayName muss ein String sein");
    expect(data.error).toContain("documentDate muss ein String sein");
  });

  it("does not overwrite document date when empty date is provided", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: "doc-1",
      displayName: "Alt",
      documentDate: new Date("2026-02-10T00:00:00.000Z"),
    });
    (prisma.document.update as jest.Mock).mockResolvedValue({
      id: "doc-1",
      displayName: "Neu",
      originalFileName: "antrag.pdf",
      storedFileName: "abc123.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      documentDate: new Date("2026-02-10T00:00:00.000Z"),
      uploadedById: "admin-1",
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
      updatedAt: new Date("2026-02-12T10:00:00.000Z"),
      uploadedBy: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
      },
    });

    const request = new NextRequest("http://localhost:3000/api/admin/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Neu", documentDate: "" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "doc-1" }) });
    expect(response.status).toBe(200);

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          documentDate: expect.anything(),
        }),
      })
    );
  });

  it("deletes document and underlying file", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: "doc-1",
      storedFileName: "abc123.pdf",
    });
    (prisma.document.delete as jest.Mock).mockResolvedValue({ id: "doc-1" });

    const request = new NextRequest("http://localhost:3000/api/admin/documents/doc-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteDocumentFile).toHaveBeenCalledWith("abc123.pdf");
  });

  it("restores file when db delete fails after file delete", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: "doc-1",
      storedFileName: "abc123.pdf",
    });
    (readDocumentFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2, 3]));
    (prisma.document.delete as jest.Mock).mockRejectedValue(new Error("DB delete failed"));

    const request = new NextRequest("http://localhost:3000/api/admin/documents/doc-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Ein Fehler ist aufgetreten");
    expect(deleteDocumentFile).toHaveBeenCalledWith("abc123.pdf");
    expect(restoreDocumentFile).toHaveBeenCalledWith("abc123.pdf", expect.any(Uint8Array));
  });
});

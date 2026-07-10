import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/ausschreibungen/route";
import { PATCH, DELETE } from "@/app/api/admin/ausschreibungen/[id]/route";
import { requireAdmin, ForbiddenError } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  deleteAusschreibungFile,
  readAusschreibungFile,
  restoreAusschreibungFile,
  writeAusschreibungFile,
} from "@/lib/ausschreibung-storage";

jest.mock("@/lib/auth-utils", () => {
  const actual = jest.requireActual("@/lib/auth-utils");
  return {
    ...actual,
    requireAdmin: jest.fn(),
  };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    ausschreibung: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/ausschreibung-storage", () => ({
  writeAusschreibungFile: jest.fn(),
  readAusschreibungFile: jest.fn(),
  deleteAusschreibungFile: jest.fn(),
  restoreAusschreibungFile: jest.fn(),
}));

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function buildPdfFile(name = "ausschreibung.pdf") {
  const file = new File([PDF_BYTES], name, { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => PDF_BYTES.buffer,
  });
  return file;
}

function requestWithFormData(url: string, method: string, formData: FormData) {
  const request = new NextRequest(url, { method });
  Object.defineProperty(request, "formData", {
    value: async () => formData,
  });
  return request;
}

describe("/api/admin/ausschreibungen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("lists ausschreibungen for admin read access", async () => {
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([
      {
        id: "a1",
        title: "Landesmeisterschaft",
        description: null,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        originalFileName: "lm.pdf",
        storedFileName: "stored.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ausschreibungen).toHaveLength(1);
    expect(requireAdmin).toHaveBeenCalledWith("read");
  });

  it("rejects list access for AUDITOR-forbidden scenarios via requireAdmin", async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(new ForbiddenError());

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("creates an ausschreibung from a valid PDF upload", async () => {
    (writeAusschreibungFile as jest.Mock).mockResolvedValue({
      storedFileName: "generated.pdf",
      filePath: "/tmp/generated.pdf",
    });
    (prisma.ausschreibung.create as jest.Mock).mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "new-1",
      ...args.data,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));

    const formData = new FormData();
    formData.append("title", "Landesmeisterschaft");
    formData.append("description", "Beschreibung");
    formData.append("expiresAt", "2026-08-01");
    formData.append("file", buildPdfFile());

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen", "POST", formData);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.title).toBe("Landesmeisterschaft");
    expect(writeAusschreibungFile).toHaveBeenCalled();
    expect(requireAdmin).toHaveBeenCalledWith("write");
  });

  it("rejects creation when required fields are missing", async () => {
    const formData = new FormData();
    formData.append("file", buildPdfFile());

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen", "POST", formData);
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(writeAusschreibungFile).not.toHaveBeenCalled();
  });

  it("rejects uploads whose content is not actually a PDF", async () => {
    const bogusBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
    const file = new File([bogusBytes], "ausschreibung.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => bogusBytes.buffer,
    });

    const formData = new FormData();
    formData.append("title", "Landesmeisterschaft");
    formData.append("expiresAt", "2026-08-01");
    formData.append("file", file);

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen", "POST", formData);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("PDF");
    expect(writeAusschreibungFile).not.toHaveBeenCalled();
  });

  it("cleans up the written file when database creation fails", async () => {
    (writeAusschreibungFile as jest.Mock).mockResolvedValue({
      storedFileName: "generated.pdf",
      filePath: "/tmp/generated.pdf",
    });
    (prisma.ausschreibung.create as jest.Mock).mockRejectedValue(new Error("db down"));

    const formData = new FormData();
    formData.append("title", "Landesmeisterschaft");
    formData.append("expiresAt", "2026-08-01");
    formData.append("file", buildPdfFile());

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen", "POST", formData);
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(deleteAusschreibungFile).toHaveBeenCalledWith("generated.pdf");
  });

  it("rejects write access when requireAdmin denies AUDITOR", async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(new ForbiddenError());

    const formData = new FormData();
    formData.append("title", "Landesmeisterschaft");
    formData.append("expiresAt", "2026-08-01");
    formData.append("file", buildPdfFile());

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen", "POST", formData);
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(writeAusschreibungFile).not.toHaveBeenCalled();
  });
});

describe("/api/admin/ausschreibungen/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: typeof prisma) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[])
    );
  });

  it("returns 404 when updating a missing ausschreibung", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("title", "Neuer Titel");

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen/missing", "PATCH", formData);
    const response = await PATCH(request, { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
  });

  it("updates metadata without touching the file when no new file is provided", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      title: "Alt",
      description: null,
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      originalFileName: "old.pdf",
      storedFileName: "old-stored.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.ausschreibung.update as jest.Mock).mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "a1",
      title: "Neuer Titel",
      description: null,
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      originalFileName: "old.pdf",
      storedFileName: "old-stored.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
    }));

    const formData = new FormData();
    formData.append("title", "Neuer Titel");
    formData.append("expiresAt", "2026-09-01");

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen/a1", "PATCH", formData);
    const response = await PATCH(request, { params: Promise.resolve({ id: "a1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Neuer Titel");
    expect(writeAusschreibungFile).not.toHaveBeenCalled();
    expect(deleteAusschreibungFile).not.toHaveBeenCalled();
  });

  it("replaces the file and deletes the old one when a new PDF is provided", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      title: "Alt",
      description: null,
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      originalFileName: "old.pdf",
      storedFileName: "old-stored.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (writeAusschreibungFile as jest.Mock).mockResolvedValue({
      storedFileName: "new-stored.pdf",
      filePath: "/tmp/new-stored.pdf",
    });
    (prisma.ausschreibung.update as jest.Mock).mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "a1",
      title: "Alt",
      description: null,
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      originalFileName: "old.pdf",
      storedFileName: "old-stored.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
    }));

    const formData = new FormData();
    formData.append("file", buildPdfFile("neu.pdf"));

    const request = requestWithFormData("http://localhost:3000/api/admin/ausschreibungen/a1", "PATCH", formData);
    const response = await PATCH(request, { params: Promise.resolve({ id: "a1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.storedFileName).toBe("new-stored.pdf");
    expect(deleteAusschreibungFile).toHaveBeenCalledWith("old-stored.pdf");
  });

  it("deletes an ausschreibung and its file", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "stored.pdf",
    });
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2, 3]));
    (prisma.ausschreibung.delete as jest.Mock).mockResolvedValue({ id: "a1" });

    const request = new NextRequest("http://localhost:3000/api/admin/ausschreibungen/a1", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "a1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteAusschreibungFile).toHaveBeenCalledWith("stored.pdf");
    expect(prisma.ausschreibung.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("restores the file if the database delete fails", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "stored.pdf",
    });
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2, 3]));
    (prisma.ausschreibung.delete as jest.Mock).mockRejectedValue(new Error("db down"));

    const request = new NextRequest("http://localhost:3000/api/admin/ausschreibungen/a1", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(500);
    expect(restoreAusschreibungFile).toHaveBeenCalledWith("stored.pdf", new Uint8Array([1, 2, 3]));
  });

  it("rejects delete access when requireAdmin denies AUDITOR", async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(new ForbiddenError());

    const request = new NextRequest("http://localhost:3000/api/admin/ausschreibungen/a1", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(403);
    expect(prisma.ausschreibung.delete).not.toHaveBeenCalled();
  });
});

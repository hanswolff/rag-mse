import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/document-directories/route";
import { PATCH, DELETE } from "@/app/api/admin/document-directories/[id]/route";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      count: jest.fn(),
    },
    documentDirectory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("/api/admin/document-directories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("returns directory list with root count", async () => {
    (prisma.documentDirectory.findMany as jest.Mock).mockResolvedValue([
      {
        id: "dir-1",
        name: "Anträge",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        updatedAt: new Date("2026-03-01T10:00:00.000Z"),
        _count: {
          documents: 3,
        },
      },
    ]);
    (prisma.document.count as jest.Mock).mockResolvedValue(2);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rootCount).toBe(2);
    expect(data.directories).toHaveLength(1);
    expect(data.directories[0]).toEqual(expect.objectContaining({
      id: "dir-1",
      name: "Anträge",
      documentCount: 3,
    }));
  });

  it("creates a directory", async () => {
    (prisma.documentDirectory.create as jest.Mock).mockResolvedValue({
      id: "dir-1",
      name: "Anträge",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T10:00:00.000Z"),
      _count: {
        documents: 0,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/admin/document-directories", {
      method: "POST",
      body: JSON.stringify({ name: "Anträge" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("Anträge");
  });

  it("returns conflict on duplicate directory", async () => {
    (prisma.documentDirectory.create as jest.Mock).mockRejectedValue({ code: "P2002" });

    const request = new NextRequest("http://localhost:3000/api/admin/document-directories", {
      method: "POST",
      body: JSON.stringify({ name: "Anträge" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("existiert bereits");
  });
});

describe("/api/admin/document-directories/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("renames a directory", async () => {
    (prisma.documentDirectory.findUnique as jest.Mock).mockResolvedValueOnce({ id: "dir-1" });
    (prisma.documentDirectory.update as jest.Mock).mockResolvedValue({
      id: "dir-1",
      name: "Formulare",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T11:00:00.000Z"),
      _count: {
        documents: 2,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/admin/document-directories/dir-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Formulare" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "dir-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Formulare");
  });

  it("rejects deleting a non-empty directory", async () => {
    (prisma.documentDirectory.findUnique as jest.Mock).mockResolvedValue({
      id: "dir-1",
      _count: {
        documents: 2,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/admin/document-directories/dir-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "dir-1" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("nicht leer");
  });

  it("deletes an empty directory", async () => {
    (prisma.documentDirectory.findUnique as jest.Mock).mockResolvedValue({
      id: "dir-1",
      _count: {
        documents: 0,
      },
    });
    (prisma.documentDirectory.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    const request = new NextRequest("http://localhost:3000/api/admin/document-directories/dir-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "dir-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("rejects delete when directory becomes non-empty concurrently", async () => {
    (prisma.documentDirectory.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "dir-1",
        _count: {
          documents: 0,
        },
      })
      .mockResolvedValueOnce({ id: "dir-1" });
    (prisma.documentDirectory.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    const request = new NextRequest("http://localhost:3000/api/admin/document-directories/dir-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "dir-1" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("nicht leer");
  });
});

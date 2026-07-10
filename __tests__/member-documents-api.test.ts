import { NextRequest } from "next/server";
import { GET } from "@/app/api/member/documents/route";
import { GET as GetDirectories } from "@/app/api/member/document-directories/route";
import { requireMember } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { DocumentArea } from "@prisma/client";

jest.mock("@/lib/auth-utils", () => ({
  requireMember: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    documentDirectory: {
      findMany: jest.fn(),
    },
  },
}));

describe("/api/member/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMember as jest.Mock).mockResolvedValue({
      id: "member-1",
      role: "MEMBER",
      email: "member@example.com",
    });
  });

  it("returns paginated member documents only", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([
      {
        id: "doc-1",
        displayName: "Mitgliedsantrag",
        originalFileName: "antrag.pdf",
        storedFileName: "abc123.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        documentDate: new Date("2026-02-10T00:00:00.000Z"),
        directoryId: null,
        directory: null,
        createdAt: new Date("2026-02-10T10:00:00.000Z"),
        updatedAt: new Date("2026-02-10T10:00:00.000Z"),
      },
    ]);
    (prisma.document.count as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3000/api/member/documents?page=1&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].displayName).toBe("Mitgliedsantrag");
    expect(data.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.area).toBe(DocumentArea.MEMBER);
  });

  it("filters by directory", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/member/documents?directory=dir-1");
    await GET(request);

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.directoryId).toBe("dir-1");
    expect(findManyCall.where.area).toBe(DocumentArea.MEMBER);
  });

  it("shows root documents when directory=root", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/member/documents?directory=root");
    await GET(request);

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.directoryId).toBeNull();
    expect(findManyCall.where.area).toBe(DocumentArea.MEMBER);
  });

  it("applies search query", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/member/documents?q=satzung");
    await GET(request);

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.displayName).toEqual({ contains: "satzung" });
  });

  it("uses custom sorting", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3000/api/member/documents?sortBy=displayName&sortDir=asc");
    await GET(request);

    const findManyCall = (prisma.document.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.orderBy).toEqual([
      { displayName: "asc" },
      { id: "desc" },
    ]);
  });

  it("clamps page to available pages", async () => {
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.count as jest.Mock).mockResolvedValue(21);

    const request = new NextRequest("http://localhost:3000/api/member/documents?page=5&limit=20");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination).toEqual({ total: 21, page: 2, limit: 20, pages: 2 });
  });
});

describe("/api/member/document-directories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMember as jest.Mock).mockResolvedValue({
      id: "member-1",
      role: "MEMBER",
      email: "member@example.com",
    });
  });

  it("returns member area directories only", async () => {
    (prisma.documentDirectory.findMany as jest.Mock).mockResolvedValue([
      {
        id: "dir-1",
        name: "Formulare",
        createdAt: new Date("2026-02-10T10:00:00.000Z"),
        updatedAt: new Date("2026-02-10T10:00:00.000Z"),
        _count: { documents: 5 },
      },
    ]);
    (prisma.document.count as jest.Mock).mockResolvedValue(3);

    const response = await GetDirectories();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rootCount).toBe(3);
    expect(data.directories).toHaveLength(1);
    expect(data.directories[0]).toEqual(expect.objectContaining({
      id: "dir-1",
      name: "Formulare",
      documentCount: 5,
    }));

    const findManyCall = (prisma.documentDirectory.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.area).toBe(DocumentArea.MEMBER);

    const countCall = (prisma.document.count as jest.Mock).mock.calls[0][0];
    expect(countCall.where).toEqual({ directoryId: null, area: DocumentArea.MEMBER });
  });
});

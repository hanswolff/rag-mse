import { GET as GET_VIEW } from "@/app/api/admin/documents/[id]/view/route";
import { GET as GET_DOWNLOAD } from "@/app/api/admin/documents/[id]/download/route";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { readDocumentFile } from "@/lib/document-storage";

jest.mock("@/lib/auth-utils", () => ({
  requireAdmin: jest.fn(),
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

describe("admin documents view/download routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      email: "admin@example.com",
    });
  });

  it("sets content length from actual file bytes for view", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: "doc-1",
      storedFileName: "stored.pdf",
      originalFileName: "antrag.pdf",
      mimeType: "application/pdf",
      sizeBytes: 999999,
    });
    (readDocumentFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2, 3, 4, 5]));

    const response = await GET_VIEW(new Request("http://localhost:3000/api/admin/documents/doc-1/view"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("5");
    expect(response.headers.get("Content-Disposition")).toContain("inline;");
  });

  it("sets content length from actual file bytes for download", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: "doc-1",
      storedFileName: "stored.pdf",
      originalFileName: "antrag.pdf",
      mimeType: "application/pdf",
      sizeBytes: 999999,
    });
    (readDocumentFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2]));

    const response = await GET_DOWNLOAD(new Request("http://localhost:3000/api/admin/documents/doc-1/download"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("2");
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
  });
});

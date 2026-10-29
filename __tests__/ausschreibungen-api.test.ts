import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { GET } from "@/app/api/ausschreibungen/route";
import { GET as GET_FILE } from "@/app/api/ausschreibungen/[id]/file/route";
import { GET as GET_ADMIN_FILE } from "@/app/api/admin/ausschreibungen/[id]/file/route";
import { prisma } from "@/lib/prisma";
import { readAusschreibungFile } from "@/lib/ausschreibung-storage";
import { Visibility } from "@/lib/visibility";
import { buildAdminSession, buildSession } from "./helpers/factories";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/ausschreibung-storage", () => ({
  readAusschreibungFile: jest.fn(),
}));

describe("/api/ausschreibungen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("splits ausschreibungen into current and historical based on expiresAt", async () => {
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([
      {
        id: "current-1",
        title: "Landesmeisterschaft",
        description: null,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        originalFileName: "current.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        visibility: Visibility.PUBLIC,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "historical-1",
        title: "Alte Ausschreibung",
        description: "Beschreibung",
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        originalFileName: "historical.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        visibility: Visibility.PUBLIC,
        createdAt: new Date("2019-01-01T00:00:00.000Z"),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.current).toHaveLength(1);
    expect(data.current[0].id).toBe("current-1");
    expect(data.historical).toHaveLength(1);
    expect(data.historical[0].id).toBe("historical-1");
  });

  it("returns an empty list when no ausschreibungen exist", async () => {
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(data.current).toEqual([]);
    expect(data.historical).toEqual([]);
  });
});

describe("/api/ausschreibungen/[id]/file", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(null);
  });

  function mockAusschreibung(visibility: Visibility) {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "abc123.pdf",
      mimeType: "application/pdf",
      originalFileName: "Landesmeisterschaft.pdf",
      visibility,
    });
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([0x25, 0x50, 0x44, 0x46]));
  }

  async function requestFile() {
    const request = new NextRequest("http://localhost:3000/api/ausschreibungen/a1/file");
    return GET_FILE(request, { params: Promise.resolve({ id: "a1" }) });
  }

  it("returns 404 when the ausschreibung does not exist", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/ausschreibungen/missing/file");
    const response = await GET_FILE(request, { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(readAusschreibungFile).not.toHaveBeenCalled();
  });

  it("serves the file for an existing ausschreibung", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "abc123.pdf",
      mimeType: "application/pdf",
      originalFileName: "Landesmeisterschaft.pdf",
      visibility: Visibility.PUBLIC,
    });
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([0x25, 0x50, 0x44, 0x46]));

    const request = new NextRequest("http://localhost:3000/api/ausschreibungen/a1/file");
    const response = await GET_FILE(request, { params: Promise.resolve({ id: "a1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
  });

  it("sets an attachment disposition when download=true is requested", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "abc123.pdf",
      mimeType: "application/pdf",
      originalFileName: "Landesmeisterschaft.pdf",
      visibility: Visibility.PUBLIC,
    });
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([0x25, 0x50, 0x44, 0x46]));

    const request = new NextRequest("http://localhost:3000/api/ausschreibungen/a1/file?download=true");
    const response = await GET_FILE(request, { params: Promise.resolve({ id: "a1" }) });

    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("only ever reads the storedFileName referenced by the matching database record", async () => {
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "linked-file.pdf",
      mimeType: "application/pdf",
      originalFileName: "Landesmeisterschaft.pdf",
      visibility: Visibility.PUBLIC,
    });
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([1, 2, 3]));

    const request = new NextRequest("http://localhost:3000/api/ausschreibungen/a1/file?download=true&storedFileName=arbitrary.pdf");
    await GET_FILE(request, { params: Promise.resolve({ id: "a1" }) });

    expect(readAusschreibungFile).toHaveBeenCalledWith("linked-file.pdf");
  });

  it("hides a member-only ausschreibung from anonymous visitors", async () => {
    mockAusschreibung(Visibility.MEMBER);

    // 404 statt 403: die Existenz einer nicht öffentlichen Ausschreibung ist
    // selbst eine Information, die anonym nichts zu suchen hat.
    expect((await requestFile()).status).toBe(404);
    expect(readAusschreibungFile).not.toHaveBeenCalled();
  });

  it("serves a member-only ausschreibung to a logged-in member without caching it", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(buildSession());
    mockAusschreibung(Visibility.MEMBER);

    const response = await requestFile();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("hides a hidden ausschreibung even from a logged-in member", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(buildSession());
    mockAusschreibung(Visibility.HIDDEN);

    expect((await requestFile()).status).toBe(404);
    expect(readAusschreibungFile).not.toHaveBeenCalled();
  });

  it("keeps the public file cache short enough that a retracted PDF stops being served", async () => {
    mockAusschreibung(Visibility.PUBLIC);

    const cacheControl = (await requestFile()).headers.get("Cache-Control");

    expect(cacheControl).toContain("must-revalidate");
    expect(cacheControl).not.toContain("stale-while-revalidate");
  });
});

describe("/api/admin/ausschreibungen/[id]/file", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readAusschreibungFile as jest.Mock).mockResolvedValue(Buffer.from([0x25, 0x50, 0x44, 0x46]));
  });

  async function requestAdminFile() {
    const request = new NextRequest("http://localhost:3000/api/admin/ausschreibungen/a1/file");
    return GET_ADMIN_FILE(request, { params: Promise.resolve({ id: "a1" }) });
  }

  it("serves a hidden ausschreibung to an administrator", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(buildAdminSession());
    (prisma.ausschreibung.findUnique as jest.Mock).mockResolvedValue({
      id: "a1",
      storedFileName: "abc123.pdf",
      mimeType: "application/pdf",
      originalFileName: "Landesmeisterschaft.pdf",
      visibility: Visibility.HIDDEN,
    });

    const response = await requestAdminFile();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("refuses a member", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(buildSession());

    expect((await requestAdminFile()).status).toBe(403);
    expect(readAusschreibungFile).not.toHaveBeenCalled();
  });
});

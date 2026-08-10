import { render, screen } from "@testing-library/react";
import NewsPage from "@/app/news/page";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    news: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe("NewsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (prisma.news.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.news.count as jest.Mock).mockResolvedValue(0);
  });

  it("renders page title and description", async () => {
    const view = await NewsPage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Aktuelle News von der RAG Schießsport MSE")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    const view = await NewsPage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Keine News gefunden")).toBeInTheDocument();
  });

  it("renders news list and pagination", async () => {
    (prisma.news.findMany as jest.Mock).mockResolvedValue([
      {
        id: "n1",
        title: "Neuigkeit",
        content: "Inhalt",
        newsDate: new Date("2026-01-31T10:00:00.000Z"),
        createdAt: new Date("2026-01-31T10:00:00.000Z"),
        updatedAt: new Date("2026-01-31T10:00:00.000Z"),
      },
    ]);
    (prisma.news.count as jest.Mock).mockResolvedValue(11);

    const view = await NewsPage({ searchParams: Promise.resolve({ page: "1" }) });
    render(view);

    expect(screen.getByText("Neuigkeit")).toBeInTheDocument();
    expect(screen.getByText("Zurück")).toBeInTheDocument();
    expect(screen.getByText("Weiter")).toBeInTheDocument();
  });

  it("shows admin button for admins", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });

    const view = await NewsPage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("News verwalten")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import NewsPage from "@/app/news/page";
import { useSession } from "next-auth/react";

const mockFetch = jest.fn();

global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({ data: null, status: "unauthenticated" })),
}));

describe("NewsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });
    mockFetch.mockImplementation(() => new Promise(() => {}));
  });

  it("renders page title and description", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.getByText("News")).toBeInTheDocument();
      expect(
        screen.getByText("Aktuelle Neuigkeiten vom RAG Schießsport MSE")
      ).toBeInTheDocument();
    });
  });

  it("displays loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<NewsPage />);

    expect(screen.getByText("Laden...")).toBeInTheDocument();
  });

  it("displays news list when data is loaded", async () => {
    const mockNews = [
      {
        id: "1",
        title: "Test News Title",
        content: "Test news content that describes the event.",
        published: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: mockNews,
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Test News Title")).toBeInTheDocument();
    expect(screen.getByText("Test news content that describes the event.")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays empty state when no news found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Keine News gefunden")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches news on page load", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/news?page=1&limit=10");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays error message on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText("Fehler beim Laden der News")
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays pagination when multiple pages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: [
          {
            id: "1",
            title: "Test News Title",
            content: "Test news content.",
            published: true,
            createdAt: "2026-01-31T10:00:00.000Z",
            updatedAt: "2026-01-31T10:00:00.000Z",
          },
        ],
        pagination: { total: 11, page: 1, limit: 10, pages: 2 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Zurück")).toBeInTheDocument();
    expect(screen.getByText("Weiter")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("formats the news creation date", async () => {
    const mockNews = [
      {
        id: "1",
        title: "Test News",
        content: "Content",
        published: true,
        createdAt: "2026-01-15T10:00:00.000Z",
        updatedAt: "2026-01-15T10:00:00.000Z",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: mockNews,
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("15.01.2026")).toBeInTheDocument();
  });

  it("truncates long news content", async () => {
    const mockNews = [
      {
        id: "1",
        title: "Test News",
        content: "This is a very long news content that should be truncated to show only three lines of text with the line-clamp utility class.",
        published: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: mockNews,
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      }),
    });

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    const newsLink = screen.getByText("Test News");
    expect(newsLink.closest("a")).toBeInTheDocument();
  });

  describe("Admin button visibility", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          news: [],
          pagination: { total: 0, page: 1, limit: 10, pages: 0 },
        }),
      });
    });

    it("does not display admin button when user is not authenticated", async () => {
      (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      expect(screen.queryByText("News verwalten")).not.toBeInTheDocument();
    });

    it("does not display admin button when user is member", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "MEMBER" } },
        status: "authenticated",
      });

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      expect(screen.queryByText("News verwalten")).not.toBeInTheDocument();
    });

    it("displays admin button when user is admin", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      const adminButton = screen.getByText("News verwalten");
      expect(adminButton).toBeInTheDocument();
      expect(adminButton.closest("a")).toHaveAttribute("href", "/admin/news");
    });
  });
});

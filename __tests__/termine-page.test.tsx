import { render, screen, waitFor } from "@testing-library/react";
import TerminePage from "@/app/termine/page";
import { useSession } from "next-auth/react";

const mockFetch = jest.fn();
const mockPush = jest.fn();

global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({ data: null, status: "unauthenticated" })),
}));

describe("TerminePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });
  });

  it("renders page title and description", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [],
        pastEvents: [],
        pagination: { total: 0, page: 1, limit: 20, pages: 0 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.getByText("Termine")).toBeInTheDocument();
      expect(
        screen.getByText("Aktuelle Termine und Veranstaltungen")
      ).toBeInTheDocument();
    });
  });

  it("displays loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<TerminePage />);

    expect(screen.getAllByText("Laden...").length).toBeGreaterThan(0);
  });

  it("displays events list when data is loaded", async () => {
    const mockEvents = [
      {
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 3 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: mockEvents,
        pastEvents: [],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("15.02.2026")).toBeInTheDocument();
    expect(screen.getByText("18:00 - 20:00")).toBeInTheDocument();
    expect(screen.getByText("Test Location")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays empty state when no events found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [],
        pastEvents: [],
        pagination: { total: 0, page: 1, limit: 20, pages: 0 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Keine Termine gefunden")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not display vote count for unauthenticated users", async () => {
    const mockEvents = [
      {
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 5 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: mockEvents,
        pastEvents: [],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("5 Stimmen")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays vote count for authenticated users", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-1", role: "MEMBER" } },
      status: "authenticated",
    });

    const mockEvents = [
      {
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 5 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: mockEvents,
        pastEvents: [],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("5 Stimmen")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches events on page load", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [],
        pastEvents: [],
        pagination: { total: 0, page: 1, limit: 20, pages: 0 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/events?page=1&limit=20");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays error message on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText("Fehler beim Laden der Termine")
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays pagination when multiple pages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "1",
            date: "2026-02-15T18:00:00.000Z",
            timeFrom: "18:00",
            timeTo: "20:00",
            location: "Test Location",
            description: "Test Description",
            latitude: null,
            longitude: null,
            visible: true,
            createdAt: "2026-01-31T10:00:00.000Z",
            _count: { votes: 0 },
          },
        ],
        pastEvents: [],
        pagination: { total: 21, page: 1, limit: 20, pages: 2 },
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<TerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Zurück")).toBeInTheDocument();
    expect(screen.getByText("Weiter")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  describe("Admin button visibility", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          events: [],
          pastEvents: [],
          pagination: { total: 0, page: 1, limit: 20, pages: 0 },
          pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
        }),
      });
    });

    it("does not display admin button when user is not authenticated", async () => {
      (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });

      render(<TerminePage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      expect(screen.queryByText("Termine verwalten")).not.toBeInTheDocument();
    });

    it("does not display admin button when user is member", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "MEMBER" } },
        status: "authenticated",
      });

      render(<TerminePage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      expect(screen.queryByText("Termine verwalten")).not.toBeInTheDocument();
    });

    it("displays admin button when user is admin", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });

      render(<TerminePage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      const adminButton = screen.getByText("Termine verwalten");
      expect(adminButton).toBeInTheDocument();
      expect(adminButton.closest("a")).toHaveAttribute("href", "/admin/termine");
    });
  });
});

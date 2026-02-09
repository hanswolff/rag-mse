import { render, screen, waitFor } from "@testing-library/react";
import VergangeneTerminePage from "@/app/termine/vergangenheit/page";
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

describe("VergangeneTerminePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });
  });

  it("renders page title and description", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: [],
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.getByText("Termine in der Vergangenheit")).toBeInTheDocument();
      expect(
        screen.getByText("Rückblick auf vergangene Veranstaltungen")
      ).toBeInTheDocument();
    });
  });

  it("displays loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<VergangeneTerminePage />);

    expect(screen.getByText("Laden...")).toBeInTheDocument();
  });

  it("displays past events list when data is loaded", async () => {
    const mockPastEvents = [
      {
        id: "1",
        date: "2026-01-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        type: "Training",
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 3 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: mockPastEvents,
        pastPagination: { total: 1, page: 1, limit: 20, pages: 1 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("15.01.2026")).toBeInTheDocument();
    expect(screen.getByText("18:00 - 20:00")).toBeInTheDocument();
    expect(screen.getByText("Test Location")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("Training")).toBeInTheDocument();
    expect(screen.queryByText("3 Anmeldungen")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays vote count for authenticated users", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-1", role: "MEMBER" } },
      status: "authenticated",
    });

    const mockPastEvents = [
      {
        id: "1",
        date: "2026-01-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        type: "Training",
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 3 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: mockPastEvents,
        pastPagination: { total: 1, page: 1, limit: 20, pages: 1 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("3 Anmeldungen")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays empty state when no past events found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: [],
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Keine vergangenen Termine gefunden")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches past events on page load", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: [],
        pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/events?pastPage=1&limit=20");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("displays error message on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<VergangeneTerminePage />);

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
        pastEvents: [
          {
            id: "1",
            date: "2026-01-15T18:00:00.000Z",
            timeFrom: "18:00",
            timeTo: "20:00",
            location: "Test Location",
            description: "Test Description",
            type: null,
            visible: true,
            createdAt: "2026-01-31T10:00:00.000Z",
            _count: { votes: 0 },
          },
        ],
        pastPagination: { total: 21, page: 1, limit: 20, pages: 2 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Zurück")).toBeInTheDocument();
    expect(screen.getByText("Weiter")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("redirects to login on 401/403 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login?returnUrl=%2F");
    });
  });

  it("displays event type badge when present", async () => {
    const mockPastEvents = [
      {
        id: "1",
        date: "2026-01-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        type: "Training",
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 0 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: mockPastEvents,
        pastPagination: { total: 1, page: 1, limit: 20, pages: 1 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Training")).toBeInTheDocument();
  });

  it("displays competition type badge", async () => {
    const mockPastEvents = [
      {
        id: "1",
        date: "2026-01-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        type: "Wettkampf",
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 0 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: mockPastEvents,
        pastPagination: { total: 1, page: 1, limit: 20, pages: 1 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Wettkampf")).toBeInTheDocument();
  });

  it("displays not visible badge for hidden events", async () => {
    const mockPastEvents = [
      {
        id: "1",
        date: "2026-01-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        type: null,
        visible: false,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 0 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: mockPastEvents,
        pastPagination: { total: 1, page: 1, limit: 20, pages: 1 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Dieser Termin ist noch nicht öffentlich")).toBeInTheDocument();
  });

  it("displays singular vote count for authenticated users", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-1", role: "MEMBER" } },
      status: "authenticated",
    });

    const mockPastEvents = [
      {
        id: "1",
        date: "2026-01-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        type: null,
        visible: true,
        createdAt: "2026-01-31T10:00:00.000Z",
        _count: { votes: 1 },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pastEvents: mockPastEvents,
        pastPagination: { total: 1, page: 1, limit: 20, pages: 1 },
      }),
    });

    render(<VergangeneTerminePage />);

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 Anmeldung")).toBeInTheDocument();
  });

  describe("Admin button visibility", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          pastEvents: [],
          pastPagination: { total: 0, page: 1, limit: 20, pages: 0 },
        }),
      });
    });

    it("does not display admin button when user is not authenticated", async () => {
      (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });

      render(<VergangeneTerminePage />);

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

      render(<VergangeneTerminePage />);

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

      render(<VergangeneTerminePage />);

      await waitFor(() => {
        expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
      });

      const adminButton = screen.getByText("Termine verwalten");
      expect(adminButton).toBeInTheDocument();
      expect(adminButton.closest("a")).toHaveAttribute("href", "/admin/termine");
    });
  });
});

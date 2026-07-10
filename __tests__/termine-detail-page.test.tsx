import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventDetailPage from "@/app/termine/[id]/page";

jest.mock("@/components/confirm-dialog", () => ({
  useConfirmDialog: () => jest.fn().mockResolvedValue(true),
}));

const mockFetch = jest.fn();
const mockPush = jest.fn();
const mockSessionState = {
  data: {
    user: {
      id: "user-1",
      email: "test@example.com",
      role: "MEMBER",
    },
  },
  status: "authenticated",
};

global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => mockSessionState),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/use-event-management", () => ({
  useEventManagement: () => ({
    events: [],
    isLoading: false,
    isCreatingEvent: false,
    isEditingEvent: false,
    isGeocoding: false,
    geocodeSuccess: false,
    error: "",
    success: "",
    editingEvent: null,
    modalEventData: {
      date: "",
      timeFrom: "",
      timeTo: "",
      location: "",
      description: "",
      latitude: "",
      longitude: "",
      type: "",
      visible: true,
    },
    setModalEventData: jest.fn(),
    initialEventData: undefined,
    isModalOpen: false,
    handleCreateEvent: jest.fn(),
    handleUpdateEvent: jest.fn(),
    handleDeleteEvent: jest.fn(),
    startEditingEvent: jest.fn(),
    cancelEditingEvent: jest.fn(),
    handleGeocode: jest.fn(),
    handleUseLatestDescription: jest.fn(),
    handlePublishEvent: jest.fn(),
    isLoadingLatestDescription: false,
    openCreateModal: jest.fn(),
    closeModal: jest.fn(),
  }),
}));

describe("EventDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState.data = {
      user: {
        id: "user-1",
        email: "test@example.com",
        role: "MEMBER",
      },
    };
    mockSessionState.status = "authenticated";
  });

  it("displays loading state initially", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(screen.getByText("Laden...")).toBeInTheDocument();
  });

  it("displays event details when data is loaded", async () => {
    const mockEvent = {
      id: "1",
      date: "2026-02-15T18:00:00.000Z",
      timeFrom: "18:00",
      timeTo: "20:00",
      location: "Test Location",
      locationDisplay: "Test Location, Musterstraße 1, 12345 Musterstadt",
      description: "Test Description",
      latitude: null,
      longitude: null,
      createdAt: "2026-01-31T10:00:00.000Z",
      updatedAt: "2026-01-31T10:00:00.000Z",
      votes: [],
      voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvent,
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("15.02.2026")).toBeInTheDocument();
    expect(screen.getByText("18:00 - 20:00")).toBeInTheDocument();
    expect(screen.getByText("Test Location, Musterstraße 1, 12345 Musterstadt")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("displays back link to events list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText("Zurück zur Termin-Übersicht")
    ).toBeInTheDocument();
  });

  it("displays voting section", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Teilnahmeanmeldung")).toBeInTheDocument();
  });

  it("displays vote buttons", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Ja")).toHaveLength(1);
    expect(screen.getAllByText("Nein")).toHaveLength(1);
    expect(screen.getAllByText("Vielleicht")).toHaveLength(1);
  });

  it("displays vote counts in pie chart", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 5, NEIN: 2, VIELLEICHT: 3 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Anmeldestand (5-8 Anmeldungen)")).toBeInTheDocument();
  });

  it("does not display list of voters for non-admin users", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [
          { id: "v1", vote: "JA", user: { id: "u1", name: "User 1" } },
          { id: "v2", vote: "NEIN", user: { id: "u2", name: "User 2" } },
        ],
        voteCounts: { JA: 1, NEIN: 1, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Angemeldet sind:")).not.toBeInTheDocument();
    expect(screen.queryByText("User 1")).not.toBeInTheDocument();
    expect(screen.queryByText("User 2")).not.toBeInTheDocument();
  });

  it("displays error message on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Termin nicht gefunden")).toBeInTheDocument();
  });

  it("displays informational message for past events", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: pastDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText("Dieser Termin ist bereits vorbei. Teilnahmeanmeldungen sind nicht mehr möglich.")
    ).toBeInTheDocument();
  });

  it("does not display informational message for future events", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: futureDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(
      screen.queryByText("Dieser Termin ist bereits vorbei. Teilnahmeanmeldungen sind nicht mehr möglich.")
    ).not.toBeInTheDocument();
  });

  it("disables voting buttons for past events", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: pastDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const voteButtons = buttons.filter((button) =>
      ["Ja", "Nein", "Vielleicht"].includes(button.textContent || "")
    );

    voteButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("enables voting buttons for future events", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: futureDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const voteButtons = buttons.filter((button) =>
      ["Ja", "Nein", "Vielleicht"].includes(button.textContent || "")
    );

    voteButtons.forEach((button) => {
      expect(button).not.toBeDisabled();
    });
  });

  it("hides delete vote button for past events even when user has voted", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: pastDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [
          {
            id: "v1",
            vote: "JA",
            user: { id: "user-1", name: "Test User" },
          },
        ],
        voteCounts: { JA: 1, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Anmeldung zurückziehen")).not.toBeInTheDocument();
  });

  it("shows delete vote button for future events when user has voted", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: futureDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [
          {
            id: "v1",
            vote: "JA",
            user: { id: "user-1", name: "Test User" },
          },
        ],
        voteCounts: { JA: 1, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Anmeldung zurückziehen")).toBeInTheDocument();
  });

  it("updates registration chart section after deleting own vote", async () => {
    const user = userEvent.setup();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "1",
          date: futureDate.toISOString(),
          timeFrom: "18:00",
          timeTo: "20:00",
          location: "Test Location",
          description: "Test Description",
          latitude: null,
          longitude: null,
          createdAt: "2026-01-31T10:00:00.000Z",
          updatedAt: "2026-01-31T10:00:00.000Z",
          votes: [
            {
              id: "v1",
              vote: "JA",
              user: { id: "user-1", name: "Test User" },
            },
          ],
          voteCounts: { JA: 1, NEIN: 0, VIELLEICHT: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "1",
          date: futureDate.toISOString(),
          timeFrom: "18:00",
          timeTo: "20:00",
          location: "Test Location",
          description: "Test Description",
          latitude: null,
          longitude: null,
          createdAt: "2026-01-31T10:00:00.000Z",
          updatedAt: "2026-01-31T10:00:00.000Z",
          votes: [],
          voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
        }),
      });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Anmeldestand (1 Anmeldung)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Anmeldung zurückziehen" }));

    await waitFor(() => {
      expect(screen.getByText("Anmeldestand (0 Anmeldungen)")).toBeInTheDocument();
    });
  });

  it("displays 'Keine Anmeldung vorhanden' for past events without user vote", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: pastDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Keine Anmeldung vorhanden")).toBeInTheDocument();
  });

  it("displays 'Sie haben sich für diesen Termin angemeldet:' for past events with user vote", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: pastDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [
          {
            id: "v1",
            vote: "JA",
            user: { id: "user-1", name: "Test User" },
          },
        ],
        voteCounts: { JA: 1, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Sie haben sich für diesen Termin angemeldet:")).toBeInTheDocument();
  });

  it("displays OpenStreetMap link when event has coordinates", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: futureDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: 52.5200,
        longitude: 13.4050,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    const mapLink = screen.getByText("Karte in neuem Tab öffnen");
    expect(mapLink).toBeInTheDocument();
    expect(mapLink).toHaveAttribute("target", "_blank");
    expect(mapLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(mapLink).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/?mlat=52.52&mlon=13.405#map=15/52.52/13.405"
    );
  });

  it("does not display OpenStreetMap link when event has no coordinates", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: futureDate.toISOString(),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Karte in neuem Tab öffnen")).not.toBeInTheDocument();
  });

  it("does not display edit button for non-admin users", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "1",
        date: "2026-02-15T18:00:00.000Z",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Test Location",
        description: "Test Description",
        latitude: null,
        longitude: null,
        createdAt: "2026-01-31T10:00:00.000Z",
        updatedAt: "2026-01-31T10:00:00.000Z",
        votes: [],
        voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
      }),
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Laden...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Bearbeiten")).not.toBeInTheDocument();
  });

  it("submits guest registration with Enter in guest-name input for admins", async () => {
    const user = userEvent.setup();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockSessionState.data = {
      user: {
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
      },
    };

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method;

      if (url.includes("/api/admin/events/1/registrations") && method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }

      if (url.includes("/api/admin/events/1/registrations")) {
        return {
          ok: true,
          json: async () => ({
            members: [{ userId: "member-2", name: "Member 2", vote: null }],
            guests: [],
          }),
        } as Response;
      }

      if (url.includes("/api/events/1")) {
        return {
          ok: true,
          json: async () => ({
            id: "1",
            date: futureDate.toISOString(),
            timeFrom: "18:00",
            timeTo: "20:00",
            location: "Test Location",
            description: "Test Description",
            latitude: null,
            longitude: null,
            createdAt: "2026-01-31T10:00:00.000Z",
            updatedAt: "2026-01-31T10:00:00.000Z",
            votes: [],
            voteCounts: { JA: 0, NEIN: 0, VIELLEICHT: 0 },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ error: "Nicht erwartet" }),
      } as Response;
    });

    await act(async () => {
      render(<EventDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    const addRegistrationButton = await screen.findByRole("button", { name: "Ja: Anmeldung hinzufügen" });
    await user.click(addRegistrationButton);
    await user.click(screen.getByLabelText("Gast"));
    const guestNameInput = screen.getByLabelText("Gastname");
    await user.type(guestNameInput, "Max Gast{enter}");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/events/1/registrations",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

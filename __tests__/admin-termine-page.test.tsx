import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import TerminePage from "../app/admin/termine/page";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { role: "ADMIN" } },
    status: "authenticated",
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("../lib/use-event-management", () => ({
  useEventManagement: jest.fn(),
}));

import { useEventManagement } from "../lib/use-event-management";

describe("TerminePage (Admin)", () => {
  const mockHandlePageChange = jest.fn();
  const defaultHook = {
    events: [
      {
        id: "1",
        date: "2026-02-01",
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Vereinsheim",
        description: "Training",
        latitude: null,
        longitude: null,
        type: "Training",
        visible: true,
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
        _count: { votes: 3 },
      },
    ],
    currentPage: 1,
    totalPages: 2,
    totalEvents: 12,
    eventsPerPage: 10,
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
    handlePublishEvent: jest.fn(),
    handlePageChange: mockHandlePageChange,
    openCreateModal: jest.fn(),
    closeModal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useEventManagement as jest.Mock).mockReturnValue(defaultHook);
  });

  it("renders create button before the event list heading", () => {
    render(<TerminePage />);

    const createButton = screen.getByRole("button", { name: "Neuen Termin erstellen" });
    const listHeading = screen.getByRole("heading", { name: "Terminliste", level: 2 });

    expect(createButton.compareDocumentPosition(listHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders total events and pagination controls", () => {
    render(<TerminePage />);

    expect(screen.getByText("12 Termine gesamt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });

  it("calls page change handler on pagination click", async () => {
    const user = userEvent.setup();
    render(<TerminePage />);

    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(mockHandlePageChange).toHaveBeenCalledWith(2);
  });
});

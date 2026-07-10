import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { AdminAusschreibungManager } from "@/components/admin-ausschreibung-manager";

const mockConfirm = jest.fn().mockResolvedValue(true);
jest.mock("@/components/confirm-dialog", () => ({
  useConfirmDialog: () => mockConfirm,
}));

const mockSessionState: { data: { user: { role: string } } | null; status: string } = {
  data: { user: { role: "ADMIN" } },
  status: "authenticated",
};

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => mockSessionState),
}));

jest.mock("next/dynamic", () => () => {
  function MockPdfViewer() {
    return <div data-testid="pdf-viewer" />;
  }
  return MockPdfViewer;
});

const AUSSCHREIBUNG = {
  id: "a1",
  title: "Landesmeisterschaft",
  description: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  originalFileName: "lm.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockFetchList() {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ ausschreibungen: [AUSSCHREIBUNG], uploadConstraints: { maxUploadMb: 15 } }),
  })) as unknown as typeof fetch;
}

describe("AdminAusschreibungManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState.data = { user: { role: "ADMIN" } };
    mockSessionState.status = "authenticated";
  });

  it("loads and renders the ausschreibung list", async () => {
    mockFetchList();
    render(<AdminAusschreibungManager />);

    await waitFor(() => expect(screen.getByText("Landesmeisterschaft")).toBeInTheDocument());
    expect(screen.getByText("Neue Ausschreibung anlegen")).toBeInTheDocument();
    expect(screen.getByText("Bearbeiten")).toBeInTheDocument();
    expect(screen.getByText("Löschen")).toBeInTheDocument();
  });

  it("hides the upload form and write actions for AUDITOR", async () => {
    mockSessionState.data = { user: { role: "AUDITOR" } };
    mockFetchList();
    render(<AdminAusschreibungManager />);

    await waitFor(() => expect(screen.getByText("Landesmeisterschaft")).toBeInTheDocument());
    expect(screen.queryByText("Neue Ausschreibung anlegen")).not.toBeInTheDocument();
    expect(screen.queryByText("Bearbeiten")).not.toBeInTheDocument();
    expect(screen.queryByText("Löschen")).not.toBeInTheDocument();
    expect(screen.getByText("Ansehen")).toBeInTheDocument();
  });

  it("deletes an ausschreibung after confirmation", async () => {
    const user = userEvent.setup();
    mockFetchList();
    const fetchMock = global.fetch as jest.Mock;

    render(<AdminAusschreibungManager />);
    await waitFor(() => expect(screen.getByText("Landesmeisterschaft")).toBeInTheDocument());

    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true }) }));
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ ausschreibungen: [], uploadConstraints: { maxUploadMb: 15 } }) }));

    await user.click(screen.getByText("Löschen"));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/ausschreibungen/a1", { method: "DELETE" }));
  });

  it("opens the PDF viewer when Ansehen is clicked", async () => {
    const user = userEvent.setup();
    mockFetchList();
    render(<AdminAusschreibungManager />);

    await waitFor(() => expect(screen.getByText("Landesmeisterschaft")).toBeInTheDocument());
    await user.click(screen.getByText("Ansehen"));
    expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
  });
});

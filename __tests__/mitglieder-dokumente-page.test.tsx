import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MemberDocumentsPage from "@/app/mitglieder-dokumente/page";
import { useDocumentsList } from "@/lib/use-documents-list";
import { useSession } from "next-auth/react";

jest.mock("@/lib/use-documents-list", () => ({
  useDocumentsList: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

describe("MemberDocumentsPage", () => {
  const baseHookState = {
    status: "authenticated" as const,
    isLoading: false,
    error: null,
    documents: [
      {
        id: "doc-1",
        displayName: "Mitgliedsordnung",
        originalFileName: "ordnung.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        documentDate: "2026-03-01T00:00:00.000Z",
        directoryId: "dir-1",
        directory: { id: "dir-1", name: "Anträge" },
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
    directories: [{ id: "dir-1", name: "Anträge", documentCount: 2 }],
    selectedDirectory: "root",
    rootCount: 1,
    searchInput: "",
    searchQuery: "",
    sortBy: "documentDate" as const,
    sortDir: "desc" as const,
    handleSortChange: jest.fn(),
    setSearchInput: jest.fn(),
    handleSubmitSearch: jest.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    clearSearch: jest.fn(),
    setPage: jest.fn(),
    navigateToRoot: jest.fn(),
    navigateToDirectory: jest.fn(),
    setSelectedDirectory: jest.fn(),
    maxUploadMb: 15,
    reload: jest.fn(),
    reloadDirectories: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: "MEMBER" } },
      status: "authenticated",
    });
    (useDocumentsList as jest.Mock).mockReturnValue(baseHookState);
  });

  it("hides directories and shows search status when a search is active", () => {
    (useDocumentsList as jest.Mock).mockReturnValue({
      ...baseHookState,
      searchInput: "ordnung",
      searchQuery: "ordnung",
    });

    render(<MemberDocumentsPage />);

    expect(screen.getByText("Suche aktiv:")).toBeInTheDocument();
    expect(screen.getByText('"ordnung"')).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Anträge" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toBeInTheDocument();
  });

  it("shows clear no-result message for active search", () => {
    (useDocumentsList as jest.Mock).mockReturnValue({
      ...baseHookState,
      documents: [],
      total: 0,
      searchInput: "keintreffer",
      searchQuery: "keintreffer",
    });

    render(<MemberDocumentsPage />);

    expect(screen.getByText('Keine Suchergebnisse für "keintreffer" gefunden.')).toBeInTheDocument();
  });

  it("triggers clearSearch when reset button is clicked", async () => {
    const user = userEvent.setup();
    const clearSearch = jest.fn();

    (useDocumentsList as jest.Mock).mockReturnValue({
      ...baseHookState,
      searchInput: "ordnung",
      searchQuery: "ordnung",
      clearSearch,
    });

    render(<MemberDocumentsPage />);

    await user.click(screen.getByRole("button", { name: "Suche zurücksetzen" }));

    expect(clearSearch).toHaveBeenCalledTimes(1);
  });

  it("shows up-navigation button when viewing a subdirectory", () => {
    (useDocumentsList as jest.Mock).mockReturnValue({
      ...baseHookState,
      selectedDirectory: "dir-1",
      documents: [],
      total: 0,
      rootCount: 0,
    });

    render(<MemberDocumentsPage />);

    expect(screen.getByLabelText("Zum übergeordneten Verzeichnis")).toBeInTheDocument();
  });

  it("does not show root empty-state when directories exist", () => {
    (useDocumentsList as jest.Mock).mockReturnValue({
      ...baseHookState,
      documents: [],
      total: 0,
      selectedDirectory: "root",
      directories: [{ id: "dir-1", name: "Anträge", documentCount: 2 }],
      rootCount: 0,
    });

    render(<MemberDocumentsPage />);

    expect(screen.queryByText("Keine Verzeichnisse oder Dokumente gefunden.")).not.toBeInTheDocument();
  });

  it("shows admin shortcut button for users with write permission", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
    });

    render(<MemberDocumentsPage />);

    expect(screen.getByRole("link", { name: "Zum Adminbereich Mitglieder-Dokumente" })).toHaveAttribute(
      "href",
      "/admin/mitglied-dokumente"
    );
  });
});

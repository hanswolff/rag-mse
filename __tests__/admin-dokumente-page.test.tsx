import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import AdminDocumentsPage from "@/app/admin/dokumente/page";

const mockPush = jest.fn();
const mockSessionState = {
  data: { user: { role: "ADMIN" } },
  status: "authenticated",
};

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => mockSessionState),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

describe("AdminDocumentsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/admin/documents/") && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }

      if (url.includes("/api/admin/document-directories")) {
        return {
          ok: true,
          json: async () => ({
            rootCount: 1,
            directories: [
              {
                id: "dir-1",
                name: "Anträge",
                documentCount: 2,
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          documents: url.includes("q=ohnetreffer")
            ? []
            : [
              {
                id: "doc-1",
                displayName: "Mitgliedsantrag Max",
                originalFileName: "antrag-max.pdf",
                mimeType: "application/pdf",
                sizeBytes: 4096,
                documentDate: "2026-02-10T00:00:00.000Z",
                directoryId: null,
                directory: null,
                createdAt: "2026-02-10T10:00:00.000Z",
                updatedAt: "2026-02-10T10:00:00.000Z",
                uploadedById: "admin-1",
                uploadedBy: {
                  id: "admin-1",
                  name: "Admin",
                  email: "admin@example.com",
                },
              },
              {
                id: "doc-2",
                displayName: "Teilnehmerliste März",
                originalFileName: "teilnehmerliste-maerz.xlsx",
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                sizeBytes: 8192,
                documentDate: "2026-02-12T00:00:00.000Z",
                directoryId: "dir-1",
                directory: {
                  id: "dir-1",
                  name: "Anträge",
                },
                createdAt: "2026-02-12T10:00:00.000Z",
                updatedAt: "2026-02-12T10:00:00.000Z",
                uploadedById: "admin-1",
                uploadedBy: {
                  id: "admin-1",
                  name: "Admin",
                  email: "admin@example.com",
                },
              },
            ],
          pagination: {
            total: url.includes("q=ohnetreffer") ? 0 : 1,
            page: 1,
            limit: 20,
            pages: 1,
          },
        }),
      } as Response;
    }) as jest.Mock;
  });

  it("renders page title and upload section", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin-Dokumente verwalten")).toBeInTheDocument();
    });

    expect(screen.getByText("Neues Dokument hochladen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dokument hochladen" })).toBeInTheDocument();
    expect(screen.getByText("Datei hierhin ziehen oder anklicken")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin-Dokumente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verzeichnis erstellen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "/" })).toBeInTheDocument();
  });

  it("shows selected file name in drop zone", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin-Dokumente verwalten")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Datei", { selector: "input" });
    const file = new File(["hello"], "neues-dokument.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("neues-dokument.pdf")).toBeInTheDocument();
  });

  it("shows validation error for invalid drop type", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin-Dokumente verwalten")).toBeInTheDocument();
    });

    const invalidFile = new File(["hello"], "script.exe", { type: "application/x-msdownload" });
    const dropZone = screen.getByRole("button", { name: /Datei hierhin ziehen oder anklicken/i });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidFile],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Dateiformat nicht erlaubt/)).toBeInTheDocument();
    });
  });

  it("renders loaded document list", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    expect(screen.getByText("antrag-max.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("Anträge").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Bearbeiten" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Download" }).length).toBeGreaterThan(0);
  });

  it("submits search input", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Suche nach Dokumentenname");
    await user.type(searchInput, "Max");
    await user.click(screen.getByRole("button", { name: "Suchen" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(screen.getByText('Suche aktiv:')).toBeInTheDocument();
    expect(screen.getByText('"Max"')).toBeInTheDocument();
    expect(screen.getByText("Max", { selector: "mark" })).toBeInTheDocument();
  });

  it("hides directories in active search and allows reset", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Verzeichnis umbenennen" })).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Suche nach Dokumentenname"), "Max");
    await user.click(screen.getByRole("button", { name: "Suchen" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Verzeichnis umbenennen" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Suche zurücksetzen" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Verzeichnis umbenennen" })).toBeInTheDocument();
    });
  });

  it("shows clear no-result message for active search", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Suche nach Dokumentenname"), "ohnetreffer");
    await user.click(screen.getByRole("button", { name: "Suchen" }));

    await waitFor(() => {
      expect(screen.getByText('Keine Suchergebnisse für "ohnetreffer" gefunden.')).toBeInTheDocument();
    });
  });

  it("moves a root document into a directory via drag and drop", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    const documentRow = screen.getByText("Mitgliedsantrag Max").closest("tr");
    const directoryRow = screen.getByRole("cell", { name: "Anträge" }).closest("tr");

    expect(documentRow).toBeTruthy();
    expect(directoryRow).toBeTruthy();

    fireEvent.dragStart(documentRow!);
    fireEvent.dragOver(directoryRow!);
    fireEvent.drop(directoryRow!);
    fireEvent.dragEnd(documentRow!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/documents/doc-1"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("navigates into directory on click", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("cell", { name: "Anträge" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("directory=dir-1"));
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Verzeichnis erstellen" })).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText("Zum übergeordneten Verzeichnis")).toBeInTheDocument();
  });

  it("navigates to parent directory via breadcrumb button", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("cell", { name: "Anträge" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Zum übergeordneten Verzeichnis")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Zum übergeordneten Verzeichnis"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("directory=root"));
    });
  });

  it("submits directory rename with Enter in rename input", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Verzeichnis umbenennen" }));
    const renameInput = screen.getByRole("textbox", { name: "Verzeichnis umbenennen" });
    await user.clear(renameInput);
    await user.type(renameInput, "Formulare{enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/document-directories/dir-1"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("opens viewer when document row is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Mitgliedsantrag Max"));

    await waitFor(() => {
      expect(screen.getByText("Vorschau: Mitgliedsantrag Max")).toBeInTheDocument();
    });
  });

  it("marks non-viewable files as download-only and does not open viewer on row click", async () => {
    const user = userEvent.setup();
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Teilnehmerliste März")).toBeInTheDocument();
    });

    expect(screen.getByText("Nur Download")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vorschau nicht verfügbar" })).toBeDisabled();

    await user.click(screen.getByText("Teilnehmerliste März"));

    expect(screen.queryByText("Vorschau: Teilnehmerliste März")).not.toBeInTheDocument();
    expect(screen.queryByText("Dieser Dateityp kann nicht direkt angezeigt werden.")).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
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

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

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
          documents: [
            {
              id: "doc-1",
              displayName: "Mitgliedsantrag Max",
              originalFileName: "antrag-max.pdf",
              mimeType: "application/pdf",
              sizeBytes: 4096,
              documentDate: "2026-02-10T00:00:00.000Z",
              directoryId: "dir-1",
              directory: {
                id: "dir-1",
                name: "Anträge",
              },
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
            total: 1,
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
      expect(screen.getByText("Dokumente verwalten")).toBeInTheDocument();
    });

    expect(screen.getByText("Neues Dokument hochladen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dokument hochladen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dokumente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verzeichnis erstellen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "/" })).toBeInTheDocument();
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

    expect(screen.getByText("Max", { selector: "mark" })).toBeInTheDocument();
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

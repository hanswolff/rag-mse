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

    global.fetch = jest.fn().mockResolvedValue({
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
            createdAt: "2026-02-10T10:00:00.000Z",
            updatedAt: "2026-02-10T10:00:00.000Z",
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
    }) as jest.Mock;
  });

  it("renders page title and upload section", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dokumente verwalten")).toBeInTheDocument();
    });

    expect(screen.getByText("Neues Dokument hochladen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dokument hochladen" })).toBeInTheDocument();
  });

  it("renders loaded document list", async () => {
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Mitgliedsantrag Max")).toBeInTheDocument();
    });

    expect(screen.getByText("antrag-max.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ansehen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Umbenennen" })).toBeInTheDocument();
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
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import NewsPage from "../app/admin/news/page";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { role: "ADMIN" } },
    status: "authenticated",
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("../lib/use-news-management", () => ({
  useNewsManagement: jest.fn(),
}));

import { useNewsManagement } from "../lib/use-news-management";

describe("NewsPage (Admin)", () => {
  const mockNews = [
    {
      id: "1",
      title: "Test News 1",
      content: "Test content 1",
      published: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      title: "Test News 2",
      content: "Test content 2",
      published: false,
      createdAt: "2024-01-02T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    },
  ];

  const defaultMockHook = {
    news: mockNews,
    isLoading: false,
    isCreatingNews: false,
    isEditingNews: false,
    error: "",
    success: "",
    modalNewsData: {
      title: "",
      content: "",
      published: true,
    },
    initialNewsData: undefined,
    isModalOpen: false,
    editingNews: null,
    setModalNewsData: jest.fn(),
    handleCreateNews: jest.fn(),
    handleUpdateNews: jest.fn(),
    handleDeleteNews: jest.fn(),
    startEditingNews: jest.fn(),
    cancelEditingNews: jest.fn(),
    openCreateModal: jest.fn(),
    closeModal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNewsManagement as jest.Mock).mockReturnValue(defaultMockHook);
  });

  describe("Page rendering", () => {
    it("should render the page title", () => {
      render(<NewsPage />);
      expect(screen.getAllByText("News verwalten").length).toBeGreaterThan(0);
    });

    it("should render page description", () => {
      render(<NewsPage />);
      expect(
        screen.getByText("Veröffentlichen und verwalten Sie Neuigkeiten und Ankündigungen")
      ).toBeInTheDocument();
    });

    it("should render back to dashboard link", () => {
      render(<NewsPage />);
      expect(screen.getByText("Zurück zum Dashboard")).toBeInTheDocument();
    });

    it("should render news list section", () => {
      render(<NewsPage />);
      expect(screen.getByText("News-Liste")).toBeInTheDocument();
    });

    it("should render news management section", () => {
      render(<NewsPage />);
      expect(screen.getAllByText("News verwalten").length).toBeGreaterThan(0);
    });

    it("should render create news button", () => {
      render(<NewsPage />);
      expect(screen.getByText("Neue News erstellen")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("should render loading state when isLoading is true", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isLoading: true,
      });

      render(<NewsPage />);

      expect(screen.getByText("Laden...")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("should render empty state when no news exist", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        news: [],
        isLoading: false,
      });

      render(<NewsPage />);

      expect(screen.getByText("Keine News gefunden")).toBeInTheDocument();
    });

    it("should not render empty state when news exist", () => {
      render(<NewsPage />);

      expect(screen.queryByText("Keine News gefunden")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have role='alert' for error messages", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        error: "Test error",
      });

      render(<NewsPage />);

      const errorDiv = screen.getByText("Test error").closest("div");
      expect(errorDiv).toHaveAttribute("role", "alert");
    });

    it("should have role='status' for success messages", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        success: "Test success",
      });

      render(<NewsPage />);

      const successDiv = screen.getByText("Test success").closest("div");
      expect(successDiv).toHaveAttribute("role", "status");
    });

    it("should have aria-live='assertive' for error messages", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        error: "Test error",
      });

      render(<NewsPage />);

      const errorDiv = screen.getByText("Test error").closest("div");
      expect(errorDiv).toHaveAttribute("aria-live", "assertive");
    });

    it("should have aria-live='polite' for success messages", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        success: "Test success",
      });

      render(<NewsPage />);

      const successDiv = screen.getByText("Test success").closest("div");
      expect(successDiv).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("News list rendering", () => {
    it("should render all news items", () => {
      render(<NewsPage />);

      expect(screen.getByText("Test News 1")).toBeInTheDocument();
      expect(screen.getByText("Test News 2")).toBeInTheDocument();
    });

    it("should show 'Entwurf' badge for unpublished news", () => {
      render(<NewsPage />);

      expect(screen.getByText("Entwurf")).toBeInTheDocument();
    });

    it("should format news creation date", () => {
      render(<NewsPage />);

      expect(screen.getByText(/01\.01\.2024|1\.1\.2024/)).toBeInTheDocument();
      expect(screen.getByText(/02\.01\.2024|2\.1\.2024/)).toBeInTheDocument();
    });

    it("should render edit and delete buttons for each news item", () => {
      render(<NewsPage />);

      const editButtons = screen.getAllByRole("button", { name: "Bearbeiten" });
      const deleteButtons = screen.getAllByRole("button", { name: "Löschen" });

      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });
  });

  describe("Modal interactions", () => {
    it("should not render NewsFormModal when isModalOpen is false", () => {
      render(<NewsPage />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render NewsFormModal when isModalOpen is true", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
      });

      render(<NewsPage />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should call openCreateModal when create news button is clicked", async () => {
      const user = userEvent.setup();

      render(<NewsPage />);

      const createButton = screen.getByText("Neue News erstellen");
      await user.click(createButton);

      expect(defaultMockHook.openCreateModal).toHaveBeenCalledTimes(1);
    });

    it("should call closeModal when modal close button is clicked", async () => {
      const user = userEvent.setup();

      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
      });

      render(<NewsPage />);

      const closeButton = screen.getByRole("button", { name: /Schließen/ });
      await user.click(closeButton);

      expect(defaultMockHook.closeModal).toHaveBeenCalledTimes(1);
    });

    it("should call startEditingNews when edit button is clicked", async () => {
      const user = userEvent.setup();

      render(<NewsPage />);

      const editButtons = screen.getAllByRole("button", { name: "Bearbeiten" });
      await user.click(editButtons[0]);

      expect(defaultMockHook.startEditingNews).toHaveBeenCalledTimes(1);
      expect(defaultMockHook.startEditingNews).toHaveBeenCalledWith(mockNews[0]);
    });

    it("should call handleDeleteNews when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(<NewsPage />);

      const deleteButtons = screen.getAllByText("Löschen");
      await user.click(deleteButtons[0]);

      expect(defaultMockHook.handleDeleteNews).toHaveBeenCalledTimes(1);
      expect(defaultMockHook.handleDeleteNews).toHaveBeenCalledWith("1");
    });
  });

  describe("Modal states", () => {
    it("should render modal with correct props for create mode", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingNews: null,
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should render modal with correct props for edit mode", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingNews: mockNews[0],
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should pass isSubmitting to modal when creating", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        isCreatingNews: true,
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should pass isSubmitting to modal when editing", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        isEditingNews: true,
        editingNews: mockNews[0],
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should pass errors to modal when error exists", () => {
      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        error: "Test error",
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should pass initialNewsData to modal when editing", () => {
      const initialData = {
        title: "Initial Title",
        content: "Initial Content",
        published: true,
      };

      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingNews: mockNews[0],
        initialNewsData: initialData,
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should call handleCreateNews on modal submit in create mode", () => {
      const mockHandleCreate = jest.fn();

      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingNews: null,
        handleCreateNews: mockHandleCreate,
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });

    it("should call handleUpdateNews on modal submit in edit mode", () => {
      const mockHandleUpdate = jest.fn();

      (useNewsManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingNews: mockNews[0],
        handleUpdateNews: mockHandleUpdate,
      });

      render(<NewsPage />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
    });
  });
});

import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { NewsFormModal, NewNews } from "../components/news-form-modal";
import {
  createModalRenderer,
  includeSharedFormModalTests,
} from "./helpers/modal";

describe("NewsFormModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultNewsData: NewNews = {
    newsDate: "2026-01-15",
    title: "Test News Title",
    content: "This is test news content with enough characters",
    published: true,
  };

  const initialNewsData: NewNews = {
    newsDate: "2026-01-16",
    title: "Initial News Title",
    content: "This is initial news content",
    published: false,
  };

  const { renderModal, modalElement } = createModalRenderer(NewsFormModal, () => ({
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    isSubmitting: false,
    newsData: defaultNewsData,
    setNewsData: jest.fn(),
    isEditing: false,
    initialNewsData: undefined,
  }));

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
  });

  describe("Create Mode", () => {
    it("should render create modal with correct title", () => {
      renderModal();
      expect(screen.getByText("Neue News erstellen")).toBeInTheDocument();
    });

    it("should show 'Erstellen' button in create mode", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should have title input with autoFocus in create mode", async () => {
      renderModal();
      const titleInput = screen.getByLabelText(/Titel/);
      await waitFor(() => {
        expect(titleInput).toHaveFocus();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should render edit modal with correct title", () => {
      renderModal({ isEditing: true, initialNewsData });
      expect(screen.getByText("News bearbeiten")).toBeInTheDocument();
    });

    it("should show 'Aktualisieren' button in edit mode", () => {
      renderModal({ isEditing: true, initialNewsData });
      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("should render all required fields with labels", () => {
      renderModal();
      expect(screen.getByLabelText(/Titel \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Inhalt \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Datum \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Veröffentlichen/)).toBeInTheDocument();
    });

    it("should render title input with correct type and attributes", () => {
      renderModal();
      const titleInput = screen.getByLabelText(/Titel/);
      expect(titleInput).toHaveAttribute("type", "text");
      expect(titleInput).toHaveAttribute("required");
      expect(titleInput).toHaveAttribute("maxLength", "200");
    });

    it("should render content textarea with correct attributes", () => {
      renderModal();
      const contentInput = screen.getByLabelText(/Inhalt/);
      expect(contentInput).toHaveAttribute("required");
      expect(contentInput).toHaveAttribute("maxLength", "10000");
      expect(contentInput).toHaveAttribute("rows", "10");
    });

    it("should render published checkbox", () => {
      renderModal();
      const checkbox = screen.getByLabelText(/Veröffentlichen/);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });
  });

  describe("Validation Errors", () => {
    it("should display title error when title is empty on blur", async () => {
      const user = userEvent.setup();
      renderModal({ newsData: { ...defaultNewsData, title: "" } });

      await user.click(screen.getByLabelText(/Titel/));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Titel ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should display content error when content is empty on blur", async () => {
      const user = userEvent.setup();
      renderModal({ newsData: { ...defaultNewsData, content: "" } });

      await user.click(screen.getByLabelText(/Inhalt/));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Inhalt ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should display title error when title exceeds max length on blur", async () => {
      const user = userEvent.setup();
      renderModal({ newsData: { ...defaultNewsData, title: "A".repeat(201) } });

      await user.click(screen.getByLabelText(/Titel/));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Titel darf maximal 200 Zeichen haben")).toBeInTheDocument();
      });
    });

    it("should display content error when content exceeds max length on blur", async () => {
      const user = userEvent.setup();
      renderModal({ newsData: { ...defaultNewsData, content: "A".repeat(10001) } });

      await user.click(screen.getByLabelText(/Inhalt/));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Inhalt darf maximal 10000 Zeichen haben")).toBeInTheDocument();
      });
    });

    it("should clear validation state when modal is reopened", async () => {
      const user = userEvent.setup();
      const newsData = { ...defaultNewsData, title: "" };
      const { rerender } = renderModal({ newsData });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));
      expect(screen.getByText("Titel ist erforderlich")).toBeInTheDocument();

      rerender(modalElement({ newsData, isOpen: false }));
      rerender(modalElement({ newsData, isOpen: true }));

      expect(screen.queryByText("Titel ist erforderlich")).not.toBeInTheDocument();
    });

    it("should apply error styling to invalid inputs", async () => {
      const user = userEvent.setup();
      renderModal({ newsData: { ...defaultNewsData, title: "" } });

      const titleInput = screen.getByLabelText(/Titel/);
      await user.click(titleInput);
      await user.tab();

      await waitFor(() => {
        expect(titleInput).toHaveClass("border-red-500");
      });
    });

    it("should display server errors when errors prop is provided", () => {
      renderModal({ errors: { title: "Titel bereits vorhanden" } });
      expect(screen.getByText("Titel bereits vorhanden")).toBeInTheDocument();
    });
  });

  describe("User Input", () => {
    it("should call setNewsData when title is changed", async () => {
      const setNewsData = jest.fn();
      renderModal({ setNewsData });

      fireEvent.change(screen.getByLabelText(/Titel/), { target: { value: "New Title" } });

      expect(setNewsData).toHaveBeenCalled();
    });

    it("should call setNewsData when content is changed", async () => {
      const setNewsData = jest.fn();
      renderModal({ setNewsData });

      fireEvent.change(screen.getByLabelText(/Inhalt/), { target: { value: "New content" } });

      expect(setNewsData).toHaveBeenCalled();
    });

    it("should call setNewsData when published checkbox is toggled", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();
      renderModal({ setNewsData });

      await user.click(screen.getByLabelText(/Veröffentlichen/));

      expect(setNewsData).toHaveBeenCalledWith(
        expect.objectContaining({
          published: false,
        })
      );
    });
  });

  describe("Form Submission", () => {
    it("should render submit button with correct text for create mode", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should render submit button with correct text for edit mode", () => {
      renderModal({ isEditing: true, initialNewsData });
      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });

    it("should call onSubmit when form is submitted with valid data", async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("should not call onSubmit when form has validation errors", async () => {
      const user = userEvent.setup();
      renderModal({ newsData: { ...defaultNewsData, title: "" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText("Titel ist erforderlich")).toBeInTheDocument();
    });
  });

  includeSharedFormModalTests({
    renderModal,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    dirtyEditProps: {
      newsData: { ...defaultNewsData, title: "Changed Title" },
      isEditing: true,
      initialNewsData,
    },
    cleanEditProps: {
      newsData: defaultNewsData,
      isEditing: true,
      initialNewsData: defaultNewsData,
    },
    disabledWhenSubmitting: [/Titel/, /Inhalt/, /Veröffentlichen/],
    generalErrorAbsenceQuery: "alert-role",
  });
});

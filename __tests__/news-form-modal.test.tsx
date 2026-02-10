import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { NewsFormModal, NewNews } from "../components/news-form-modal";

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

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    window.confirm = jest.fn(() => true);
  });

  describe("Create Mode", () => {
    it("should render create modal with correct title", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      expect(screen.getByText("Neue News erstellen")).toBeInTheDocument();
    });

    it("should show 'Erstellen' button in create mode", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should have title input with autoFocus in create mode", async () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      await waitFor(() => {
        expect(titleInput).toHaveFocus();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should render edit modal with correct title", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={true}
          initialNewsData={initialNewsData}
        />
      );

      expect(screen.getByText("News bearbeiten")).toBeInTheDocument();
    });

    it("should show 'Aktualisieren' button in edit mode", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={true}
          initialNewsData={initialNewsData}
        />
      );

      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("should render all required fields with labels", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      expect(screen.getByLabelText(/Titel \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Inhalt \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Datum \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Veröffentlichen/)).toBeInTheDocument();
    });

    it("should render title input with correct type and attributes", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      expect(titleInput).toHaveAttribute("type", "text");
      expect(titleInput).toHaveAttribute("required");
      expect(titleInput).toHaveAttribute("maxLength", "200");
    });

    it("should render content textarea with correct attributes", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const contentInput = screen.getByLabelText(/Inhalt/);
      expect(contentInput).toHaveAttribute("required");
      expect(contentInput).toHaveAttribute("maxLength", "10000");
      expect(contentInput).toHaveAttribute("rows", "10");
    });

    it("should render published checkbox", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const checkbox = screen.getByLabelText(/Veröffentlichen/);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });
  });

  describe("Validation Errors", () => {
    it("should display title error when title is empty on blur", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, title: "" }}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      await user.click(titleInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Titel ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should display content error when content is empty on blur", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, content: "" }}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const contentInput = screen.getByLabelText(/Inhalt/);
      await user.click(contentInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Inhalt ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should display title error when title exceeds max length on blur", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();
      const longTitle = "A".repeat(201);

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, title: longTitle }}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      await user.click(titleInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Titel darf maximal 200 Zeichen haben")).toBeInTheDocument();
      });
    });

    it("should display content error when content exceeds max length on blur", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();
      const longContent = "A".repeat(10001);

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, content: longContent }}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const contentInput = screen.getByLabelText(/Inhalt/);
      await user.click(contentInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Inhalt darf maximal 10000 Zeichen haben")).toBeInTheDocument();
      });
    });

    it("should apply error styling to invalid inputs", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, title: "" }}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      await user.click(titleInput);
      await user.tab();

      await waitFor(() => {
        expect(titleInput).toHaveClass("border-red-500");
      });
    });

    it("should display server errors when errors prop is provided", () => {
      const serverErrors = { title: "Titel bereits vorhanden" };

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
          errors={serverErrors}
        />
      );

      expect(screen.getByText("Titel bereits vorhanden")).toBeInTheDocument();
    });
  });

  describe("Unsaved Changes Confirmation", () => {
    it("should show confirmation dialog when closing with unsaved changes", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, title: "Changed Title" }}
          setNewsData={jest.fn()}
          isEditing={true}
          initialNewsData={initialNewsData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).toHaveBeenCalledWith(
        "Sie haben ungespeicherte Änderungen. Wirklich schließen?"
      );
    });

    it("should close modal without confirmation when no unsaved changes", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={true}
          initialNewsData={defaultNewsData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not close when user cancels confirmation dialog", () => {
      window.confirm = jest.fn(() => false);

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, title: "Changed Title" }}
          setNewsData={jest.fn()}
          isEditing={true}
          initialNewsData={initialNewsData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("User Input", () => {
    it("should call setNewsData when title is changed", async () => {
      const setNewsData = jest.fn();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      fireEvent.change(titleInput, { target: { value: "New Title" } });

      expect(setNewsData).toHaveBeenCalled();
    });

    it("should call setNewsData when content is changed", async () => {
      const setNewsData = jest.fn();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const contentInput = screen.getByLabelText(/Inhalt/);
      fireEvent.change(contentInput, { target: { value: "New content" } });

      expect(setNewsData).toHaveBeenCalled();
    });

    it("should call setNewsData when published checkbox is toggled", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const checkbox = screen.getByLabelText(/Veröffentlichen/);
      await user.click(checkbox);

      expect(setNewsData).toHaveBeenCalledWith(
        expect.objectContaining({
          published: false,
        })
      );
    });
  });

  describe("Form Submission", () => {
    it("should render submit button with correct text for create mode", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      expect(submitButton).toBeInTheDocument();
    });

    it("should render submit button with correct text for edit mode", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={true}
          initialNewsData={initialNewsData}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Aktualisieren" });
      expect(submitButton).toBeInTheDocument();
    });

    it("should call onSubmit when form is submitted with valid data", async () => {
      const user = userEvent.setup();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("should not call onSubmit when form has validation errors", async () => {
      const setNewsData = jest.fn();
      const user = userEvent.setup();

      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={{ ...defaultNewsData, title: "" }}
          setNewsData={setNewsData}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText("Titel ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when cancel button is clicked", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Disabled State", () => {
    it("should disable all inputs when isSubmitting is true", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const titleInput = screen.getByLabelText(/Titel/);
      const contentInput = screen.getByLabelText(/Inhalt/);
      const checkbox = screen.getByLabelText(/Veröffentlichen/);

      expect(titleInput).toBeDisabled();
      expect(contentInput).toBeDisabled();
      expect(checkbox).toBeDisabled();
    });

    it("should show 'Wird gespeichert...' text when isSubmitting is true", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      expect(screen.getByText("Wird gespeichert...")).toBeInTheDocument();
    });

    it("should disable submit button when isSubmitting is true", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Wird gespeichert..." });
      expect(submitButton).toBeDisabled();
    });

    it("should disable cancel button when isSubmitting is true", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("General Errors", () => {
    it("should display general error when errors.general is provided", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
          errors={{ general: "Ein allgemeiner Fehler ist aufgetreten" }}
        />
      );

      expect(screen.getByText("Ein allgemeiner Fehler ist aufgetreten")).toBeInTheDocument();
    });

    it("should not display general error when errors.general is not provided", () => {
      render(
        <NewsFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
          errors={{}}
        />
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Not Rendered When Closed", () => {
    it("should not render when isOpen is false", () => {
      render(
        <NewsFormModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          newsData={defaultNewsData}
          setNewsData={jest.fn()}
          isEditing={false}
          initialNewsData={undefined}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

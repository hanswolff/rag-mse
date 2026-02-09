import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { UserFormModal } from "../components/user-form-modal";
import { Role } from "@prisma/client";

describe("UserFormModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultUserData = {
    email: "test@example.com",
    name: "Test User",
    address: "Test Address",
    phone: "123456789",
    role: Role.MEMBER,
    memberSince: "",
    dateOfBirth: "",
    rank: "",
    pk: "",
    hasPossessionCard: false,
  };

  const initialUserData = {
    email: "initial@example.com",
    name: "Initial User",
    address: "",
    phone: "",
    role: Role.MEMBER,
    memberSince: "",
    dateOfBirth: "",
    rank: "",
    pk: "",
    hasPossessionCard: false,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    // Mock window.confirm
    window.confirm = jest.fn(() => true);
  });

  describe("Create Mode", () => {
    it("should render create modal with correct title", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      expect(screen.getByText("Benutzer erstellen")).toBeInTheDocument();
    });

    it("should show 'Erstellen' button in create mode", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should have email input with autoFocus in create mode", async () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      await waitFor(() => {
        expect(emailInput).toHaveFocus();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should render edit modal with correct title", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={initialUserData}
        />
      );

      expect(screen.getByText("Benutzer bearbeiten")).toBeInTheDocument();
    });

    it("should show 'Aktualisieren' button in edit mode", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={initialUserData}
        />
      );

      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });

    it("should have name input with autoFocus in edit mode", async () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={initialUserData}
        />
      );

      const nameInput = screen.getByLabelText(/Name/);
      await waitFor(() => {
        expect(nameInput).toHaveFocus();
      });
    });
  });

  describe("Form Fields", () => {
    it("should render all required fields with labels", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      expect(screen.getByLabelText(/E-Mail \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Name \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Adresse/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Telefon/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Geburtsdatum/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dienstgrad/)).toBeInTheDocument();
      expect(screen.getByLabelText(/PK/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Waffenbesitzkarte/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Mitglied seit/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Rolle \*/)).toBeInTheDocument();
    });

    it("should render email input with correct type", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      expect(emailInput).toHaveAttribute("type", "email");
    });

    it("should render phone input with correct type", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const phoneInput = screen.getByLabelText(/Telefon/);
      expect(phoneInput).toHaveAttribute("type", "tel");
    });

    it("should render role select with correct options", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      expect(screen.getByRole("option", { name: "Mitglied" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Administrator" })).toBeInTheDocument();
    });

    it("should have required fields marked", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      const nameInput = screen.getByLabelText(/Name/);
      const roleSelect = screen.getByLabelText(/Rolle/);

      expect(emailInput).toHaveAttribute("required");
      expect(nameInput).toHaveAttribute("required");
      expect(roleSelect).toHaveAttribute("required");
    });
  });

  describe("Validation Errors", () => {
    it("should display email error when email is invalid on blur", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, email: "" }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should display name error when name is invalid on blur", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, name: "" }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const nameInput = screen.getByLabelText(/Name/);
      await user.click(nameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Name ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should apply error styling to invalid inputs", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, email: "" }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveClass("border-red-500");
      });
    });

    it("should display server errors when errors prop is provided", () => {
      const serverErrors = { email: "E-Mail bereits vergeben" };

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
          errors={serverErrors}
        />
      );

      expect(screen.getByText("E-Mail bereits vergeben")).toBeInTheDocument();
    });
  });

  describe("Unsaved Changes Confirmation", () => {
    it("should show confirmation dialog when closing with unsaved changes", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, email: "changed@example.com" }}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={initialUserData}
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
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={defaultUserData}
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
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, email: "changed@example.com" }}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={initialUserData}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      fireEvent.click(cancelButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("User Input", () => {
    it("should call setUserData when email is changed", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      await user.clear(emailInput);
      await user.type(emailInput, "new@example.com");

      expect(setUserData).toHaveBeenCalled();
    });

    it("should call setUserData when name is changed", async () => {
      const setUserData = jest.fn();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: "New Name" } });

      expect(setUserData).toHaveBeenCalled();
    });

    it("should call setUserData when address is changed", async () => {
      const setUserData = jest.fn();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const addressInput = screen.getByLabelText(/Adresse/);
      fireEvent.change(addressInput, { target: { value: "New Address" } });

      expect(setUserData).toHaveBeenCalled();
    });

    it("should call setUserData when role is changed", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const roleSelect = screen.getByLabelText(/Rolle/);
      await user.selectOptions(roleSelect, Role.ADMIN);

      expect(setUserData).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.ADMIN,
        })
      );
    });
  });

  describe("Form Submission", () => {
    it("should render submit button with correct text for create mode", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      expect(submitButton).toBeInTheDocument();
    });

    it("should render submit button with correct text for edit mode", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={true}
          initialUserData={initialUserData}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Aktualisieren" });
      expect(submitButton).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty email", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, email: "" }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty name", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, name: "" }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Name ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has invalid email", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{ ...defaultUserData, email: "invalid-email" }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("E-Mail hat ungültiges Format")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has all required fields empty", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();

      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={{
            email: "",
            name: "",
            address: "",
            phone: "",
            role: Role.MEMBER,
            memberSince: "",
            dateOfBirth: "",
            rank: "",
            pk: "",
            hasPossessionCard: false,
          }}
          setUserData={setUserData}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Erstellen" });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();
      expect(screen.getByText("Name ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when cancel button is clicked", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
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
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const emailInput = screen.getByLabelText(/E-Mail/);
      const nameInput = screen.getByLabelText(/Name/);
      const addressInput = screen.getByLabelText(/Adresse/);
      const phoneInput = screen.getByLabelText(/Telefon/);
      const roleSelect = screen.getByLabelText(/Rolle/);
      const dateOfBirthInput = screen.getByLabelText(/Geburtsdatum/);
      const rankInput = screen.getByLabelText(/Dienstgrad/);
      const pkInput = screen.getByLabelText(/PK/);
      const memberSinceInput = screen.getByLabelText(/Mitglied seit/);

      expect(emailInput).toBeDisabled();
      expect(nameInput).toBeDisabled();
      expect(addressInput).toBeDisabled();
      expect(phoneInput).toBeDisabled();
      expect(roleSelect).toBeDisabled();
      expect(dateOfBirthInput).toBeDisabled();
      expect(rankInput).toBeDisabled();
      expect(pkInput).toBeDisabled();
      expect(memberSinceInput).toBeDisabled();
    });

    it("should show 'Wird gespeichert...' text when isSubmitting is true", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      expect(screen.getByText("Wird gespeichert...")).toBeInTheDocument();
    });

    it("should disable submit button when isSubmitting is true", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const submitButton = screen.getByRole("button", { name: "Wird gespeichert..." });
      expect(submitButton).toBeDisabled();
    });

    it("should disable cancel button when isSubmitting is true", () => {
      render(
        <UserFormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Abbrechen" });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("Not Rendered When Closed", () => {
    it("should not render when isOpen is false", () => {
      render(
        <UserFormModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          userData={defaultUserData}
          setUserData={jest.fn()}
          isEditing={false}
          initialUserData={undefined}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

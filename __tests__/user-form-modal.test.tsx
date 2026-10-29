import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { UserFormModal } from "../components/user-form-modal";
import { Role } from "@prisma/client";
import {
  createModalRenderer,
  includeSharedFormModalTests,
} from "./helpers/modal";

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
    reservistsAssociation: "",
    associationMemberNumber: "",
    hasPossessionCard: false,
    adminNotes: "",
  };

  const initialUserData = {
    ...defaultUserData,
    email: "initial@example.com",
    name: "Initial User",
    address: "",
    phone: "",
  };

  const { renderModal, modalElement } = createModalRenderer(UserFormModal, () => ({
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    isSubmitting: false,
    userData: defaultUserData,
    setUserData: jest.fn(),
    isEditing: false,
    initialUserData: undefined,
  }));

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
  });

  describe("Create Mode", () => {
    it("should render create modal with correct title", () => {
      renderModal();
      expect(screen.getByText("Benutzer erstellen")).toBeInTheDocument();
    });

    it("should show 'Erstellen' button in create mode", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should have email input with autoFocus in create mode", async () => {
      renderModal();
      const emailInput = screen.getByLabelText(/E-Mail/);
      await waitFor(() => {
        expect(emailInput).toHaveFocus();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should render edit modal with correct title", () => {
      renderModal({ isEditing: true, initialUserData });
      expect(screen.getByText("Benutzer bearbeiten")).toBeInTheDocument();
    });

    it("should show 'Aktualisieren' button in edit mode", () => {
      renderModal({ isEditing: true, initialUserData });
      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });

    it("should have name input with autoFocus in edit mode", async () => {
      renderModal({ isEditing: true, initialUserData });
      const nameInput = screen.getByLabelText(/Name/);
      await waitFor(() => {
        expect(nameInput).toHaveFocus();
      });
    });
  });

  describe("Form Fields", () => {
    it("should render all required fields with labels", () => {
      renderModal();
      expect(screen.getByLabelText(/E-Mail \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Name \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Adresse/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Telefon/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Geburtsdatum/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Dienstgrad/)).toBeInTheDocument();
      expect(screen.getByLabelText(/PK/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Reservistenkameradschaft/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Mitgliedsnummer im Verband/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Waffenbesitzkarte/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Mitglied seit/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Rolle \*/)).toBeInTheDocument();
    });

    it("should place address directly after phone and birth date fields", () => {
      renderModal();

      const addressInput = screen.getByLabelText(/Adresse/);
      const rankInput = screen.getByLabelText(/Dienstgrad/);

      expect(addressInput.compareDocumentPosition(rankInput)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("should render email input with correct type", () => {
      renderModal();
      expect(screen.getByLabelText(/E-Mail/)).toHaveAttribute("type", "email");
    });

    it("should render phone input with correct type", () => {
      renderModal();
      expect(screen.getByLabelText(/Telefon/)).toHaveAttribute("type", "tel");
    });

    it("should render role select with correct options", () => {
      renderModal();
      expect(screen.getByRole("option", { name: "Mitglied" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Administrator" })).toBeInTheDocument();
    });

    it("should have required fields marked", () => {
      renderModal();
      expect(screen.getByLabelText(/E-Mail/)).toHaveAttribute("required");
      expect(screen.getByLabelText(/Name/)).toHaveAttribute("required");
      expect(screen.getByLabelText(/Rolle/)).toHaveAttribute("required");
    });
  });

  describe("Validation Errors", () => {
    it("should display email error when email is invalid on blur", async () => {
      const user = userEvent.setup();
      renderModal({ userData: { ...defaultUserData, email: "" } });

      await user.click(screen.getByLabelText(/E-Mail/));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should display name error when name is invalid on blur", async () => {
      const user = userEvent.setup();
      renderModal({ userData: { ...defaultUserData, name: "" } });

      await user.click(screen.getByLabelText(/Name/));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Name ist erforderlich")).toBeInTheDocument();
      });
    });

    it("should clear validation state when modal is reopened", async () => {
      const user = userEvent.setup();
      const userData = { ...defaultUserData, email: "" };
      const { rerender } = renderModal({ userData });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));
      expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();

      rerender(modalElement({ userData, isOpen: false }));
      rerender(modalElement({ userData, isOpen: true }));

      expect(screen.queryByText("E-Mail ist erforderlich")).not.toBeInTheDocument();
    });

    it("should apply error styling to invalid inputs", async () => {
      const user = userEvent.setup();
      renderModal({ userData: { ...defaultUserData, email: "" } });

      const emailInput = screen.getByLabelText(/E-Mail/);
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveClass("border-red-500");
      });
    });

    it("should display server errors when errors prop is provided", () => {
      renderModal({ errors: { email: "E-Mail bereits vergeben" } });
      expect(screen.getByText("E-Mail bereits vergeben")).toBeInTheDocument();
    });
  });

  describe("User Input", () => {
    it("should call setUserData when email is changed", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();
      renderModal({ setUserData });

      const emailInput = screen.getByLabelText(/E-Mail/);
      await user.clear(emailInput);
      await user.type(emailInput, "new@example.com");

      expect(setUserData).toHaveBeenCalled();
    });

    it("should call setUserData when name is changed", async () => {
      const setUserData = jest.fn();
      renderModal({ setUserData });

      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "New Name" } });

      expect(setUserData).toHaveBeenCalled();
    });

    it("should call setUserData when address is changed", async () => {
      const setUserData = jest.fn();
      renderModal({ setUserData });

      fireEvent.change(screen.getByLabelText(/Adresse/), { target: { value: "New Address" } });

      expect(setUserData).toHaveBeenCalled();
    });

    it("should call setUserData when role is changed", async () => {
      const setUserData = jest.fn();
      const user = userEvent.setup();
      renderModal({ setUserData });

      await user.selectOptions(screen.getByLabelText(/Rolle/), Role.ADMIN);

      expect(setUserData).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.ADMIN,
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
      renderModal({ isEditing: true, initialUserData });
      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty email", async () => {
      const user = userEvent.setup();
      renderModal({ userData: { ...defaultUserData, email: "" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has validation errors - empty name", async () => {
      const user = userEvent.setup();
      renderModal({ userData: { ...defaultUserData, name: "" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("Name ist erforderlich")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has invalid email", async () => {
      const user = userEvent.setup();
      renderModal({ userData: { ...defaultUserData, email: "invalid-email" } });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("E-Mail hat ungültiges Format")).toBeInTheDocument();
    });

    it("should not call onSubmit when form has all required fields empty", async () => {
      const user = userEvent.setup();
      renderModal({
        userData: {
          ...defaultUserData,
          email: "",
          name: "",
          address: "",
          phone: "",
        },
      });

      await user.click(screen.getByRole("button", { name: "Erstellen" }));

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText("E-Mail ist erforderlich")).toBeInTheDocument();
      expect(screen.getByText("Name ist erforderlich")).toBeInTheDocument();
    });
  });

  includeSharedFormModalTests({
    renderModal,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    dirtyEditProps: {
      userData: { ...defaultUserData, email: "changed@example.com" },
      isEditing: true,
      initialUserData,
    },
    cleanEditProps: {
      userData: defaultUserData,
      isEditing: true,
      initialUserData: defaultUserData,
    },
    disabledWhenSubmitting: [
      /E-Mail/,
      /Name/,
      /Adresse/,
      /Telefon/,
      /Rolle/,
      /Geburtsdatum/,
      /Dienstgrad/,
      /PK/,
      /Mitglied seit/,
    ],
  });
});

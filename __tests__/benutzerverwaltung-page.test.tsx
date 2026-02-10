import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import BenutzerverwaltungPage from "../app/admin/benutzerverwaltung/page";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { role: "ADMIN" } },
    status: "authenticated",
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("../lib/use-user-management", () => ({
  useUserManagement: jest.fn(),
}));

import { useUserManagement } from "../lib/use-user-management";
import { Role } from "@prisma/client";

describe("BenutzerverwaltungPage", () => {
  const mockUsers = [
    {
      id: "1",
      email: "admin@example.com",
      name: "Admin User",
      role: Role.ADMIN,
      address: "Admin Street",
      phone: "123456",
      createdAt: "2024-01-01T00:00:00Z",
      memberSince: "2023-01-01T00:00:00Z",
      dateOfBirth: "1990-01-01T00:00:00Z",
      rank: "Oberleutnant",
      pk: "12345",
      reservistsAssociation: "RK Neubrandenburg",
      associationMemberNumber: "V12345",
      hasPossessionCard: true,
    },
    {
      id: "2",
      email: "member@example.com",
      name: "Member User",
      role: Role.MEMBER,
      address: null,
      phone: null,
      createdAt: "2024-01-02T00:00:00Z",
      memberSince: null,
      dateOfBirth: null,
      rank: null,
      pk: null,
      reservistsAssociation: null,
      associationMemberNumber: null,
      hasPossessionCard: false,
    },
  ];

  const defaultMockHook = {
    users: mockUsers,
    isLoading: false,
    isCreatingUser: false,
    isUpdatingUser: false,
    isSendingInvite: false,
    error: "",
    success: "",
    inviteEmail: "",
    modalUserData: {
      email: "",
      name: "",
      address: "",
      phone: "",
      role: Role.MEMBER,
      memberSince: "",
      dateOfBirth: "",
      rank: "",
      pk: "",
      reservistsAssociation: "",
      associationMemberNumber: "",
      hasPossessionCard: false,
    },
    isModalOpen: false,
    editingUser: null,
    setInviteEmail: jest.fn(),
    setModalUserData: jest.fn(),
    handleCreateUser: jest.fn(),
    handleUpdateUser: jest.fn(),
    handleSendInvite: jest.fn(),
    handleDeleteUser: jest.fn(),
    startEditingUser: jest.fn(),
    openCreateModal: jest.fn(),
    openEditModal: jest.fn(),
    closeModal: jest.fn(),
    canDeleteUser: jest.fn(() => true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useUserManagement as jest.Mock).mockReturnValue(defaultMockHook);
  });

  describe("Page rendering", () => {
    it("should render the page title", () => {
      render(<BenutzerverwaltungPage />);
      expect(screen.getByText("Benutzerverwaltung")).toBeInTheDocument();
    });

    it("should render page description", () => {
      render(<BenutzerverwaltungPage />);
      expect(
        screen.getByText("Verwalten Sie Benutzerkonten und senden Sie Einladungen")
      ).toBeInTheDocument();
    });

    it("should render back to dashboard link", () => {
      render(<BenutzerverwaltungPage />);
      expect(screen.getByText("Zurück zum Dashboard")).toBeInTheDocument();
    });

    it("should render user list section", () => {
      render(<BenutzerverwaltungPage />);
      expect(screen.getByText("Benutzerliste")).toBeInTheDocument();
    });

    it("should render invite form", () => {
      render(<BenutzerverwaltungPage />);
      expect(screen.getByText("Einladung versenden")).toBeInTheDocument();
    });

    it("should render add user button", () => {
      render(<BenutzerverwaltungPage />);
      expect(screen.getByText("Neuen Benutzer erstellen")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("should render loading skeleton when isLoading is true", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isLoading: true,
      });

      render(<BenutzerverwaltungPage />);

      // Check for skeleton elements
      const skeletons = screen.getAllByRole("generic").filter(function(el) {
        return el.className.includes("animate-pulse");
      });
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Empty state", () => {
    it("should render empty state when no users exist", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        users: [],
        isLoading: false,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Noch keine Benutzer vorhanden")).toBeInTheDocument();
      expect(screen.getByText("Ersten Benutzer erstellen")).toBeInTheDocument();
    });

    it("should not render empty state when users exist", () => {
      render(<BenutzerverwaltungPage />);

      expect(screen.queryByText("Noch keine Benutzer vorhanden")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have role='alert' for error messages", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        error: "Test error",
      });

      render(<BenutzerverwaltungPage />);

      const errorDiv = screen.getByText("Test error").closest("div");
      expect(errorDiv).toHaveAttribute("role", "alert");
    });

    it("should have role='status' for success messages", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        success: "Test success",
      });

      render(<BenutzerverwaltungPage />);

      const successDiv = screen.getByText("Test success").closest("div");
      expect(successDiv).toHaveAttribute("role", "status");
    });

    it("should have aria-live='assertive' for error messages", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        error: "Test error",
      });

      render(<BenutzerverwaltungPage />);

      const errorDiv = screen.getByText("Test error").closest("div");
      expect(errorDiv).toHaveAttribute("aria-live", "assertive");
    });

    it("should have aria-live='polite' for success messages", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        success: "Test success",
      });

      render(<BenutzerverwaltungPage />);

      const successDiv = screen.getByText("Test success").closest("div");
      expect(successDiv).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("Modal interactions", () => {
    it("should not render UserFormModal when isModalOpen is false", () => {
      render(<BenutzerverwaltungPage />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render UserFormModal when isModalOpen is true", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser: null,
        modalUserData: {
          email: "",
          name: "",
          address: "",
          phone: "",
          role: Role.MEMBER,
          memberSince: "",
          dateOfBirth: "",
          rank: "",
          pk: "",
          reservistsAssociation: "",
          associationMemberNumber: "",
          hasPossessionCard: false,
        },
      });

      render(<BenutzerverwaltungPage />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should call openCreateModal when add user button is clicked", async () => {
      const user = userEvent.setup();
      render(<BenutzerverwaltungPage />);

      const addButton = screen.getByText("Neuen Benutzer erstellen");
      await user.click(addButton);

      expect(defaultMockHook.openCreateModal).toHaveBeenCalledTimes(1);
    });

    it("should call closeModal when modal close button is clicked", async () => {
      const user = userEvent.setup();
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
      });

      render(<BenutzerverwaltungPage />);

      const closeButton = screen.getByLabelText("Schließen");
      await user.click(closeButton);

      expect(defaultMockHook.closeModal).toHaveBeenCalledTimes(1);
    });
  });

  describe("User list interactions", () => {
    it("should render all users", () => {
      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Admin User")).toBeInTheDocument();
      expect(screen.getByText("Member User")).toBeInTheDocument();
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      expect(screen.getByText("member@example.com")).toBeInTheDocument();
    });

    it("should render user roles", () => {
      render(<BenutzerverwaltungPage />);

      const adminBadges = screen.getAllByText("Admin");
      const memberBadges = screen.getAllByText("Mitglied");

      expect(adminBadges.length).toBeGreaterThan(0);
      expect(memberBadges.length).toBeGreaterThan(0);
    });

    it("should call startEditingUser when edit button is clicked", async () => {
      const user = userEvent.setup();
      render(<BenutzerverwaltungPage />);

      const editButtons = screen.getAllByText("Bearbeiten");
      await user.click(editButtons[0]);

      expect(defaultMockHook.startEditingUser).toHaveBeenCalledTimes(1);
    });

    it("should call handleDeleteUser when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(<BenutzerverwaltungPage />);

      const deleteButtons = screen.getAllByText("Löschen");
      await user.click(deleteButtons[0]);

      expect(defaultMockHook.handleDeleteUser).toHaveBeenCalledTimes(1);
    });

    it("should disable delete button when user cannot be deleted", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        canDeleteUser: jest.fn(() => false),
      });

      render(<BenutzerverwaltungPage />);

      const deleteButtons = screen.getAllByText("Löschen");
      expect(deleteButtons[0]).toBeDisabled();
    });
  });

  describe("Invite form interactions", () => {
    it("should call setInviteEmail when email input changes", async () => {
      const user = userEvent.setup();
      render(<BenutzerverwaltungPage />);

      const emailInput = screen.getByPlaceholderText("beispiel@email.de");
      await user.type(emailInput, "test@example.com");

      expect(defaultMockHook.setInviteEmail).toHaveBeenCalled();
    });

    it("should call handleSendInvite when invite form is submitted", async () => {
      const user = userEvent.setup();
      render(<BenutzerverwaltungPage />);

      const emailInput = screen.getByPlaceholderText("beispiel@email.de");
      await user.type(emailInput, "test@example.com");

      const form = emailInput.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      expect(defaultMockHook.handleSendInvite).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error and success messages", () => {
    it("should render error message when error exists", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        error: "Test error message",
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("should render success message when success exists", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        success: "Test success message",
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Test success message")).toBeInTheDocument();
    });
  });

  describe("Modal states", () => {
    it("should render create modal with correct title when editingUser is null", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser: null,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Benutzer erstellen")).toBeInTheDocument();
    });

    it("should render edit modal with correct title when editingUser exists", () => {
      const editingUser = {
        id: "1",
        email: "edit@example.com",
        name: "Edit User",
        role: Role.MEMBER,
        address: "Edit Address",
        phone: "123456",
        createdAt: "2024-01-01T00:00:00Z",
        memberSince: "2023-01-01T00:00:00Z",
        dateOfBirth: "1990-01-01T00:00:00Z",
        rank: "Oberleutnant",
        pk: "12345",
        reservistsAssociation: "RK Neubrandenburg",
        associationMemberNumber: "V12345",
        hasPossessionCard: true,
      };

      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Benutzer bearbeiten")).toBeInTheDocument();
    });

    it("should show create submit button when editingUser is null", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser: null,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByRole("button", { name: "Erstellen" })).toBeInTheDocument();
    });

    it("should show update submit button when editingUser exists", () => {
      const editingUser = {
        id: "1",
        email: "edit@example.com",
        name: "Edit User",
        role: Role.MEMBER,
        address: "Edit Address",
        phone: "123456",
        createdAt: "2024-01-01T00:00:00Z",
        memberSince: "2023-01-01T00:00:00Z",
        dateOfBirth: "1990-01-01T00:00:00Z",
        rank: "Oberleutnant",
        pk: "12345",
        reservistsAssociation: "RK Neubrandenburg",
        associationMemberNumber: "V12345",
        hasPossessionCard: true,
      };

      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
    });
  });

  describe("Loading states", () => {
    it("should render loading skeleton when isLoading is true", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isLoading: true,
      });

      render(<BenutzerverwaltungPage />);

      // Check for skeleton elements instead of "Laden..." text
      expect(screen.getAllByRole("generic").some(function(el) {
        return el.className.includes("animate-pulse");
      })).toBe(true);
    });

    it("should show submitting text when isCreatingUser is true", () => {
      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser: null,
        isCreatingUser: true,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Wird gespeichert...")).toBeInTheDocument();
    });

    it("should show submitting text when isUpdatingUser is true", () => {
      const editingUser = {
        id: "1",
        email: "edit@example.com",
        name: "Edit User",
        role: Role.MEMBER,
        address: "Edit Address",
        phone: "123456",
        createdAt: "2024-01-01T00:00:00Z",
        memberSince: "2023-01-01T00:00:00Z",
        dateOfBirth: "1990-01-01T00:00:00Z",
        rank: "Oberleutnant",
        pk: "12345",
        reservistsAssociation: "RK Neubrandenburg",
        associationMemberNumber: "V12345",
        hasPossessionCard: true,
      };

      (useUserManagement as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isModalOpen: true,
        editingUser,
        isUpdatingUser: true,
      });

      render(<BenutzerverwaltungPage />);

      expect(screen.getByText("Wird gespeichert...")).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordChangeForm } from "@/components/password-change-form";

describe("PasswordChangeForm", () => {
  const mockOnSubmit = jest.fn();
  const mockOnCurrentPasswordChange = jest.fn();
  const mockOnNewPasswordChange = jest.fn();
  const mockOnConfirmPasswordChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders password change form", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      expect(screen.getByText("Passwort ändern", { selector: "h2" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Aktuelles Passwort/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Passwort bestätigen/i)).toBeInTheDocument();
      expect(screen.getByText("Passwort ändern", { selector: "button" })).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={true}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      expect(screen.getByText("Wird geändert...")).toBeInTheDocument();
    });

    it("shows server error message", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
          error="Server error"
        />
      );

      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    it("shows password requirements", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      expect(screen.getByText("Passwort-Anforderungen:")).toBeInTheDocument();
      expect(screen.getByText(/mindestens 8 Zeichen/i)).toBeInTheDocument();
      expect(screen.getByText(/Mindestens ein Großbuchstabe/i)).toBeInTheDocument();
      expect(screen.getByText(/Mindestens ein Kleinbuchstabe/i)).toBeInTheDocument();
      expect(screen.getByText(/Mindestens eine Ziffer/i)).toBeInTheDocument();
    });
  });

  describe("Form Interaction", () => {
    it("calls onCurrentPasswordChange when current password input changes", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const input = screen.getByLabelText(/Aktuelles Passwort/i);
      await user.type(input, "t");

      expect(mockOnCurrentPasswordChange).toHaveBeenCalled();
    });

    it("calls onNewPasswordChange when new password input changes", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const input = screen.getByLabelText(/Neues Passwort/i);
      await user.type(input, "n");

      expect(mockOnNewPasswordChange).toHaveBeenCalled();
    });

    it("calls onConfirmPasswordChange when confirm password input changes", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const input = screen.getByLabelText(/Passwort bestätigen/i);
      await user.type(input, "c");

      expect(mockOnConfirmPasswordChange).toHaveBeenCalled();
    });

    it("calls onSubmit when form is submitted with valid data", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="NewPass123"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="NewPass123"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("prevents default form submission for valid submit", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="NewPass123"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="NewPass123"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const form = screen.getByRole("button", { name: "Passwort ändern" }).closest("form");
      expect(form).not.toBeNull();

      const submitEvent = fireEvent.submit(form!);

      expect(submitEvent).toBe(false);
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validation", () => {
    it("shows validation errors for empty fields after submission attempt", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      // Wait for validation state to update
      await waitFor(() => {
        // Check that validation errors are shown (may appear in summary list and/or below fields)
        expect(screen.getAllByText(/Aktuelles Passwort ist erforderlich/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Neues Passwort ist erforderlich/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Passwortbestätigung ist erforderlich/i).length).toBeGreaterThan(0);
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows validation error for password mismatch", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="NewPass123"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="DifferentPass123"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(screen.getByText(/Neues Passwort und Passwortbestätigung stimmen nicht überein/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows validation error when new password matches current password", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="SamePass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="SamePass123"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="SamePass123"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(screen.getByText(/Neues Passwort muss vom aktuellen Passwort abweichen/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows validation error for password without uppercase letter", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="newpass123"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="newpass123"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(screen.getByText(/Passwort muss mindestens einen Großbuchstaben enthalten/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows validation error for password without lowercase letter", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="NEWPASS123"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="NEWPASS123"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(screen.getByText(/Passwort muss mindestens einen Kleinbuchstaben enthalten/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows validation error for password without digit", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="NewPassabc"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="NewPassabc"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(screen.getByText(/Passwort muss mindestens eine Ziffer enthalten/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows validation error for short password", async () => {
      const user = userEvent.setup();
      render(
        <PasswordChangeForm
          isChangingPassword={false}
          onSubmit={mockOnSubmit}
          currentPassword="OldPass123"
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword="NewP1"
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword="NewP1"
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Passwort ändern", { selector: "button" });
      await user.click(submitButton);

      expect(screen.getByText(/Passwort muss mindestens 8 Zeichen lang sein/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("disables inputs when loading", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={true}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      expect(screen.getByLabelText(/Aktuelles Passwort/i)).toBeDisabled();
      expect(screen.getByLabelText(/Neues Passwort/i)).toBeDisabled();
      expect(screen.getByLabelText(/Passwort bestätigen/i)).toBeDisabled();
    });

    it("disables submit button when loading", () => {
      render(
        <PasswordChangeForm
          isChangingPassword={true}
          onSubmit={mockOnSubmit}
          currentPassword=""
          onCurrentPasswordChange={mockOnCurrentPasswordChange}
          newPassword=""
          onNewPasswordChange={mockOnNewPasswordChange}
          confirmPassword=""
          onConfirmPasswordChange={mockOnConfirmPasswordChange}
        />
      );

      const submitButton = screen.getByText("Wird geändert...");
      expect(submitButton).toBeDisabled();
    });
  });
});

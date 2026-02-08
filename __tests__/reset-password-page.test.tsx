import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ResetPasswordPage from "../app/passwort-zuruecksetzen/[token]/page";
import { useRouter } from "next/navigation";

jest.mock("next/navigation");

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("ResetPasswordPage", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("Rendering", () => {
    it("should render loading state initially", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValue(
        new Promise(() => {})
      );

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      expect(screen.getByText("RAG Schießsport MSE")).toBeInTheDocument();
      expect(screen.getByText("Passwort zurücksetzen")).toBeInTheDocument();
      expect(screen.getByText("Wird geladen...")).toBeInTheDocument();
    });

    it("should display error state for invalid token", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Ungültiger Link" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "invalid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Ungültiger Link/i)).toBeInTheDocument();
      });
    });

    it("should display error state for expired token", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ error: "Der Link ist abgelaufen" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "expired-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Der Link ist abgelaufen/i)).toBeInTheDocument();
      });
    });

    it("should display links on error state", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Ungültiger Link" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "invalid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByRole("link", { name: "Neuen Link anfordern" })).toHaveAttribute(
          "href",
          "/passwort-vergessen"
        );
        expect(screen.getByRole("link", { name: "Zum Login" })).toHaveAttribute("href", "/login");
      });
    });
  });

  describe("Valid Token State", () => {
    beforeEach(() => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: "test@example.com", expiresAt: new Date() }),
      } as Response);
    });

    it("should render reset password form after valid token", async () => {
      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Passwort bestätigen/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Passwort ändern" })).toBeInTheDocument();
      });
    });

    it("should display password requirements", async () => {
      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Passwort-Anforderungen:")).toBeInTheDocument();
        expect(screen.getByText("Mindestens 8 Zeichen")).toBeInTheDocument();
        expect(screen.getByText("Mindestens ein Großbuchstabe")).toBeInTheDocument();
        expect(screen.getByText("Mindestens ein Kleinbuchstabe")).toBeInTheDocument();
        expect(screen.getByText("Mindestens eine Ziffer")).toBeInTheDocument();
      });
    });

    it("should display cancel link", async () => {
      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        const cancelLink = screen.getByRole("link", { name: "Abbrechen und zum Login" });
        expect(cancelLink).toHaveAttribute("href", "/login");
      });
    });
  });

  describe("Form Submission", () => {
    beforeEach(() => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: "test@example.com", expiresAt: new Date() }),
      } as Response);
    });

    it("should submit new password to reset API", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Passwort wurde erfolgreich geändert" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.change(confirmInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/auth/reset-password/valid-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "Password1" }),
        });
      });
    });

    it("should show error when passwords do not match", async () => {
      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.change(confirmInput, { target: { value: "Password2" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Die Passwörter stimmen nicht überein/i)).toBeInTheDocument();
      });
    });

    it("should show error for weak password", async () => {
      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "weak" } });
      fireEvent.change(confirmInput, { target: { value: "weak" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Passwort muss mindestens 8 Zeichen lang sein/i)).toBeInTheDocument();
      });
    });

    it("should display success message after successful reset", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Passwort wurde erfolgreich geändert" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.change(confirmInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Passwort wurde erfolgreich geändert/i)).toBeInTheDocument();
      });
    });

    it("should redirect to login after successful reset", async () => {
      jest.useFakeTimers();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Passwort wurde erfolgreich geändert" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.change(confirmInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Passwort wurde erfolgreich geändert/i)).toBeInTheDocument();
      });

      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });

      jest.useRealTimers();
    });

    it("should display API error on failure", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Ein Fehler ist aufgetreten" }),
      } as Response);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.change(confirmInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Ein Fehler ist aufgetreten/i)).toBeInTheDocument();
      });
    });
  });

  describe("Loading States", () => {
    beforeEach(() => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: "test@example.com", expiresAt: new Date() }),
      } as Response);
    });

    it("should show loading state while submitting", async () => {
      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(fetchPromise);

      await act(async () => {
        render(<ResetPasswordPage params={Promise.resolve({ token: "valid-token" })} />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/Neues Passwort/i);
      const confirmInput = screen.getByLabelText(/Passwort bestätigen/i);
      const submitButton = screen.getByRole("button", { name: "Passwort ändern" });

      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.change(confirmInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent("Wird geändert...");

      resolveFetch!({
        ok: true,
        json: async () => ({ message: "Passwort wurde erfolgreich geändert" }),
      } as Response);

      await waitFor(() => {
        expect(screen.getByText(/Passwort wurde erfolgreich geändert/i)).toBeInTheDocument();
      });
    });
  });
});

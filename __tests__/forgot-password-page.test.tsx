import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "../app/passwort-vergessen/page";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("Rendering", () => {
    it("should render forgot password form with all fields", () => {
      render(<ForgotPasswordPage />);

      expect(screen.getByText("RAG Schießsport MSE")).toBeInTheDocument();
      expect(screen.getByText("Passwort vergessen")).toBeInTheDocument();
      expect(screen.getByLabelText(/E-Mail/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link anfordern" })).toBeInTheDocument();
    });

    it("should display link back to login", () => {
      render(<ForgotPasswordPage />);

      const loginLink = screen.getByRole("link", { name: "Zurück zum Login" });
      expect(loginLink).toHaveAttribute("href", "/login");
    });
  });

  describe("Form Submission", () => {
    it("should submit email to forgot password API", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.",
        }),
      } as Response);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        });
      });
    });

    it("should display success message after submission", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.",
        }),
      } as Response);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Wenn diese E-Mail registriert ist/i)).toBeInTheDocument();
      });
    });

    it("should hide form after successful submission", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.",
        }),
      } as Response);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByLabelText(/E-Mail/i)).not.toBeInTheDocument();
      });
    });

    it("should display error message on API failure", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Ein Fehler ist aufgetreten" }),
      } as Response);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Ein Fehler ist aufgetreten/i)).toBeInTheDocument();
      });
    });

    it("should display error message on network error", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error("Network error")
      );

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Ein Fehler ist aufgetreten/i)).toBeInTheDocument();
      });
    });

    it("should send email as entered (trimming/lowercasing happens on backend)", async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.",
        }),
      } as Response);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "Test@Example.COM" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "Test@Example.COM" }),
        });
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state while submitting", async () => {
      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValueOnce(fetchPromise);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent("Wird gesendet...");

      resolveFetch!({
        ok: true,
        json: async () => ({
          message: "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.",
        }),
      } as Response);

      await waitFor(() => {
        expect(submitButton).not.toBeInTheDocument();
      });
    });

    it("should disable input while submitting", async () => {
      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValueOnce(fetchPromise);

      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const submitButton = screen.getByRole("button", { name: "Link anfordern" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitButton);

      expect(emailInput).toBeDisabled();

      resolveFetch!({
        ok: true,
        json: async () => ({
          message: "Wenn diese E-Mail registriert ist, erhalten Sie in Kürze einen Link.",
        }),
      } as Response);

      await waitFor(() => {
        expect(emailInput).not.toBeInTheDocument();
      });
    });
  });
});

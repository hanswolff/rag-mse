import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../app/login/page";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

global.fetch = jest.fn();

jest.mock("next-auth/react");
jest.mock("next/navigation");

describe("LoginPage", () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/login");
    (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
    (global.fetch as jest.Mock).mockClear();
  });

  describe("Rendering", () => {
    it("should render login form with all fields", () => {
      render(<LoginPage />);

      expect(screen.getByText("RAG Schießsport MSE")).toBeInTheDocument();
      expect(screen.getByText("Login")).toBeInTheDocument();
      expect(screen.getByLabelText(/E-Mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument();
    });

    it("should display contact link for problems", () => {
      render(<LoginPage />);

      expect(screen.getByText(/Bei Problemen wenden Sie sich bitte an den/i)).toBeInTheDocument();
      const contactLink = screen.getByRole("link", { name: "Administrator" });
      expect(contactLink).toHaveAttribute("href", "/kontakt");
    });
  });

  describe("Form Validation", () => {
    it("should show generic error for password that fails authentication", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Ungültige E-Mail oder Passwort" }),
      });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "weak" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Ungültige E-Mail oder Passwort/i)).toBeInTheDocument();
      });
    });

    it("should submit any password without client-side validation", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      (signIn as jest.Mock).mockResolvedValue({ error: "CredentialsSignin", ok: false });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "simple" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com", password: "simple" }),
        });
      });
    });
  });

  describe("Successful Login", () => {
    it("should redirect to returnUrl on successful login when provided", async () => {
      window.history.replaceState({}, "", "/login?returnUrl=%2Fprofil");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      (signIn as jest.Mock).mockResolvedValue({ ok: true });
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "MEMBER" } },
        status: "authenticated",
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/E-Mail/i), { target: { value: "test@example.com" } });
      fireEvent.change(screen.getByLabelText(/Passwort/i), { target: { value: "Password1" } });
      fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/profil");
      });
    });

    it("should ignore unsafe returnUrl and use default redirect", async () => {
      window.history.replaceState({}, "", "/login?returnUrl=https%3A%2F%2Fevil.example%2Fphish");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      (signIn as jest.Mock).mockResolvedValue({ ok: true });
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "MEMBER" } },
        status: "authenticated",
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/E-Mail/i), { target: { value: "test@example.com" } });
      fireEvent.change(screen.getByLabelText(/Passwort/i), { target: { value: "Password1" } });
      fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });

    it("should redirect to home page on successful login for regular member", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      (signIn as jest.Mock).mockResolvedValue({ ok: true });
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "MEMBER" } },
        status: "authenticated",
      });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith("credentials", {
          email: "test@example.com",
          password: "Password1",
          redirect: false,
        });
        expect(mockPush).toHaveBeenCalledWith("/");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("should redirect to admin dashboard on successful login for admin", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      (signIn as jest.Mock).mockResolvedValue({ ok: true });
      (useSession as jest.Mock).mockReturnValue({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "admin@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "AdminPassword" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith("credentials", {
          email: "admin@example.com",
          password: "AdminPassword",
          redirect: false,
        });
        expect(mockPush).toHaveBeenCalledWith("/admin");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe("Loading State", () => {
    it("should disable form and show loading text during submission", async () => {
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      (global.fetch as jest.Mock).mockReturnValue(fetchPromise);
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent("Anmeldung...");
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
      });

      resolveFetch!({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      (signIn as jest.Mock).mockResolvedValue({ ok: true });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display error message on authentication failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Ungültige E-Mail oder Passwort" }),
      });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Ungültige E-Mail oder Passwort")).toBeInTheDocument();
      });
    });

    it("should display generic error message on unexpected error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Ein Fehler ist aufgetreten/i)).toBeInTheDocument();
      });
    });

    it("should clear error message when user starts typing", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Ungültige E-Mail oder Passwort" }),
      });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/E-Mail/i);
      const passwordInput = screen.getByLabelText(/Passwort/i);
      const submitButton = screen.getByRole("button", { name: "Anmelden" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Ungültige E-Mail oder Passwort")).toBeInTheDocument();
      });

      fireEvent.change(passwordInput, { target: { value: "NewPassword1" } });

      await waitFor(() => {
        expect(screen.queryByText("Ungültige E-Mail oder Passwort")).not.toBeInTheDocument();
      });
    });
  });
});

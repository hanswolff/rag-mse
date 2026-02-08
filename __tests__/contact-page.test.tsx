import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ContactPage from "@/app/kontakt/page";

global.fetch = jest.fn();

describe("ContactPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
    jest.resetAllMocks();
  });

  it("should render contact form", () => {
    render(<ContactPage />);

    expect(screen.getByText("Kontakt")).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("E-Mail *")).toBeInTheDocument();
    expect(screen.getByLabelText("Nachricht *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nachricht senden" })).toBeInTheDocument();
  });

  it("should update form fields on user input", () => {
    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "Max Mustermann" } });
    fireEvent.change(emailInput, { target: { value: "max@example.com" } });
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });

    expect(nameInput).toHaveValue("Max Mustermann");
    expect(emailInput).toHaveValue("max@example.com");
    expect(messageInput).toHaveValue("Dies ist eine Testnachricht.");
  });

  it("should display character count for message", () => {
    render(<ContactPage />);

    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(messageInput, { target: { value: "Test" } });

    expect(screen.getByText("4 / 2000 Zeichen")).toBeInTheDocument();
  });

  it("should clear error on input change", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: ["Ein Fehler ist aufgetreten."] }),
    });

    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "Max Mustermann" } });
    fireEvent.change(emailInput, { target: { value: "max@example.com" } });
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });

    const form = screen.getByRole("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Ein Fehler ist aufgetreten/i)).toBeInTheDocument();
    });

    fireEvent.change(messageInput, { target: { value: "Dies ist eine längere Nachricht" } });

    expect(screen.queryByText(/Ein Fehler ist aufgetreten/i)).not.toBeInTheDocument();
  });

  it("should submit form successfully and display success message", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Ihre Nachricht wurde erfolgreich gesendet." }),
    });

    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "Max Mustermann" } });
    fireEvent.change(emailInput, { target: { value: "max@example.com" } });
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });

    const form = screen.getByRole("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Max Mustermann",
          email: "max@example.com",
          message: "Dies ist eine Testnachricht.",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Ihre Nachricht wurde erfolgreich gesendet/i)).toBeInTheDocument();
    });

    expect(nameInput).toHaveValue("");
    expect(emailInput).toHaveValue("");
    expect(messageInput).toHaveValue("");
  });

  it("should display error message on validation error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        errors: ["Name muss mindestens 2 Zeichen lang sein", "Bitte geben Sie eine gültige E-Mail-Adresse ein"],
      }),
    });

    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "M" } });
    fireEvent.blur(nameInput);
    fireEvent.change(emailInput, { target: { value: "invalid" } });
    fireEvent.blur(emailInput);
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });
    fireEvent.blur(messageInput);

    await waitFor(() => {
      expect(screen.getByText("Name muss mindestens 2 Zeichen lang sein")).toBeInTheDocument();
      expect(screen.getByText("Bitte geben Sie eine gültige E-Mail-Adresse ein")).toBeInTheDocument();
    });
  });

  it("should display error message on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "Max Mustermann" } });
    fireEvent.change(emailInput, { target: { value: "max@example.com" } });
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });

    await waitFor(() => {
      expect(nameInput).toHaveValue("Max Mustermann");
      expect(emailInput).toHaveValue("max@example.com");
      expect(messageInput).toHaveValue("Dies ist eine Testnachricht.");
    });

    const form = screen.getByRole("form");
    fireEvent.submit(form);

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith("/api/contact", expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }));
      },
      { timeout: 3000 }
    );

    await waitFor(
      () => {
        expect(screen.getByText("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should disable form while loading", async () => {
    interface FetchResponse {
      ok: boolean;
      json: () => Promise<{ message: string }>;
    }

    let resolveFetch: (value: FetchResponse) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValue(fetchPromise);

    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "Max Mustermann" } });
    fireEvent.change(emailInput, { target: { value: "max@example.com" } });
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });

    const form = screen.getByRole("form");
    fireEvent.submit(form);

    await waitFor(() => {
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Wird gesendet...");
      expect(nameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(messageInput).toBeDisabled();
    });

    resolveFetch!({
      ok: true,
      json: async () => ({ message: "Ihre Nachricht wurde erfolgreich gesendet." }),
    });

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("Nachricht senden");
    });
  });

  it("should disable form after successful submission", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Ihre Nachricht wurde erfolgreich gesendet." }),
    });

    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name *");
    const emailInput = screen.getByLabelText("E-Mail *");
    const messageInput = screen.getByLabelText("Nachricht *");

    fireEvent.change(nameInput, { target: { value: "Max Mustermann" } });
    fireEvent.change(emailInput, { target: { value: "max@example.com" } });
    fireEvent.change(messageInput, { target: { value: "Dies ist eine Testnachricht." } });

    const form = screen.getByRole("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Ihre Nachricht wurde erfolgreich gesendet/i)).toBeInTheDocument();
    });

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(nameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(messageInput).toBeDisabled();
  });

  it("should have a back link to home page", () => {
    render(<ContactPage />);

    const backLink = screen.getByText("Zurück zur Startseite");
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/");
  });
});

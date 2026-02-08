import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CookieBanner } from "../components/cookie-banner";

const LOCAL_STORAGE_KEY = "cookie-consent";

describe("CookieBanner", () => {
  let localStorageMock: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
    clear: jest.Mock;
    length: number;
    key: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    };
    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  describe("Rendering", () => {
    it("should not render banner when consent is already given", () => {
      localStorageMock.getItem.mockReturnValue("accepted");

      render(<CookieBanner />);

      const banner = screen.queryByRole("dialog");
      expect(banner).not.toBeInTheDocument();
    });

    it("should render banner when no consent is given", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toBeInTheDocument();
      expect(screen.getByText(/Cookies für die Authentifizierung/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Akzeptieren" })).toBeInTheDocument();
    });

    it("should render with correct accessibility attributes", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toHaveAttribute("aria-labelledby", "cookie-banner-title");
      expect(banner).toHaveAttribute("aria-describedby", "cookie-banner-description");

      const description = screen.getByText(/Cookies für die Authentifizierung/i);
      expect(description).toHaveAttribute("id", "cookie-banner-description");

      const button = screen.getByRole("button", { name: "Akzeptieren" });
      expect(button).toHaveAttribute("type", "button");
    });

    it("should render cookie message in German", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      expect(
        screen.getByText(/Wir verwenden Cookies für die Authentifizierung/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/bessere Nutzungserfahrung zu bieten/i)).toBeInTheDocument();
      expect(screen.getByText(/Nutzung unserer Website stimmen Sie der/i)).toBeInTheDocument();
    });

    it("should render button with correct styling", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const button = screen.getByRole("button", { name: "Akzeptieren" });
      expect(button).toHaveClass("btn-primary", "px-4", "sm:px-6", "py-2");
    });

    it("should be fixed at bottom of screen", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toHaveClass("fixed", "bottom-0");
    });

    it("should have high z-index for overlay", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toHaveClass("z-overlay");
    });
  });

  describe("User Interactions", () => {
    it("should save consent to localStorage when accept button is clicked", async () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const acceptButton = screen.getByRole("button", { name: "Akzeptieren" });
      fireEvent.click(acceptButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEY,
        "accepted"
      );
    });

    it("should hide banner after accepting cookies", async () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toBeInTheDocument();

      const acceptButton = screen.getByRole("button", { name: "Akzeptieren" });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(banner).not.toBeInTheDocument();
      });
    });

    it("should only show accept button", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent("Akzeptieren");
    });

    it("should handle multiple clicks without errors", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const acceptButton = screen.getByRole("button", { name: "Akzeptieren" });

      fireEvent.click(acceptButton);
      fireEvent.click(acceptButton);

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("LocalStorage Behavior", () => {
    it("should check localStorage on mount", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    });

    it("should not show banner if consent value exists (even if not 'accepted')", () => {
      localStorageMock.getItem.mockReturnValue("some-value");

      render(<CookieBanner />);

      const banner = screen.queryByRole("dialog");
      expect(banner).not.toBeInTheDocument();
    });

    it("should call localStorage.getItem with correct key", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      expect(localStorageMock.getItem).toHaveBeenCalledTimes(1);
    });

    it("should call localStorage.setItem with correct key and value on accept", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const acceptButton = screen.getByRole("button", { name: "Akzeptieren" });
      fireEvent.click(acceptButton);

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, "accepted");
    });
  });

  describe("Responsive Design", () => {
    it("should have responsive text classes", () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<CookieBanner />);

      const description = screen.getByText(/Cookies für die Authentifizierung/i);
      expect(description).toHaveClass("text-xs", "sm:text-sm");
    });

    it("should have responsive flex direction classes", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { container } = render(<CookieBanner />);
      const content = container.querySelector(".flex-col.sm\\:flex-row");

      expect(content).toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("should have dark theme styling", () => {
      const { unmount } = render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toHaveClass("bg-gray-900", "text-white");

      unmount();
    });

    it("should have shadow for elevation", () => {
      const { unmount } = render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toHaveClass("shadow-lg");

      unmount();
    });

    it("should have proper padding", () => {
      const { unmount } = render(<CookieBanner />);

      const banner = screen.getByRole("dialog");
      expect(banner).toHaveClass("p-3", "sm:p-4");

      unmount();
    });
  });
});

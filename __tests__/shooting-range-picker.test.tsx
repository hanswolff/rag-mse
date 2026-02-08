import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ShootingRangePicker } from "../components/shooting-range-picker";

const mockRanges = [
  {
    id: "1",
    name: "Schießstand Berlin",
    street: "Musterstraße 1",
    postalCode: "10115",
    city: "Berlin",
    latitude: 52.52,
    longitude: 13.405,
  },
  {
    id: "2",
    name: "Schießstand Hamburg",
    street: null,
    postalCode: "20095",
    city: "Hamburg",
    latitude: 53.551,
    longitude: 9.993,
  },
  {
    id: "3",
    name: "Schießstand München",
    street: "Marienplatz 1",
    postalCode: "80331",
    city: "München",
    latitude: 48.135,
    longitude: 11.582,
  },
];

describe("ShootingRangePicker", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the trigger button", () => {
      const mockOnSelect = jest.fn();
      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      expect(triggerButton).toBeInTheDocument();
    });

    it("should not render modal initially", () => {
      const mockOnSelect = jest.fn();
      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should disable button when disabled prop is true", () => {
      const mockOnSelect = jest.fn();
      render(<ShootingRangePicker disabled={true} onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      expect(triggerButton).toBeDisabled();
    });
  });

  describe("Modal opening", () => {
    it("should open modal when trigger button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Schießstand auswählen" })).toBeInTheDocument();
    });

    it("should fetch ranges when modal opens", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      expect(mockFetch).toHaveBeenCalledWith("/api/ranges");
    });
  });

  describe("Loading state", () => {
    it("should show loading message while fetching", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ ranges: mockRanges }),
                }),
              100
            )
          )
      );

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      expect(screen.getByText("Schießstände werden geladen...")).toBeInTheDocument();
    });
  });

  describe("Displaying ranges", () => {
    it("should display loaded ranges in sorted order", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const rangeButtons = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Schießstand") && !btn.textContent?.includes("auswählen")
      );
      expect(rangeButtons).toHaveLength(3);

      expect(screen.getByText("Schießstand Berlin")).toBeInTheDocument();
      expect(screen.getByText("Schießstand Hamburg")).toBeInTheDocument();
      expect(screen.getByText("Schießstand München")).toBeInTheDocument();
    });

    it("should display range name with address when street is present", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: [mockRanges[0]] }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Musterstraße 1 · 10115 Berlin")).toBeInTheDocument();
      });
    });

    it("should display range name with city only when street is null", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: [mockRanges[1]] }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("20095 Hamburg")).toBeInTheDocument();
      });
    });

    it("should show message when no ranges are available", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: [] }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Keine Schießstände verfügbar.")).toBeInTheDocument();
      });
    });
  });

  describe("Error handling", () => {
    it("should display error message when fetch fails", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Server error" }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("should display default error message when fetch throws", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("Range selection", () => {
    it("should call onSelect with correct data when range is selected", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: [mockRanges[0]] }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const rangeButton = screen.getByRole("button", { name: /Schießstand Berlin/i });
      await user.click(rangeButton);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(
        mockRanges[0],
        "Schießstand Berlin, Berlin"
      );
    });

    it("should close modal after selection", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: [mockRanges[0]] }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const rangeButton = screen.getByRole("button", { name: /Schießstand Berlin/i });
      await user.click(rangeButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Modal closing", () => {
    it("should close modal when close button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Schließen");
      await user.click(closeButton);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should close modal when backdrop is clicked", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const backdrop = screen.getByRole("dialog").querySelector(".fixed.inset-0");
      expect(backdrop).toBeInTheDocument();

      await user.click(backdrop!);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should close modal when Escape key is pressed", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should clear error and ranges when modal is closed", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Schießstand Berlin")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Schließen");
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      await user.click(triggerButton);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Sorting", () => {
    it("should sort ranges by name in German locale", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const rangeButtons = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Schießstand") && !btn.textContent?.includes("auswählen")
      );

      expect(rangeButtons[0]).toHaveTextContent("Schießstand Berlin");
      expect(rangeButtons[1]).toHaveTextContent("Schießstand Hamburg");
      expect(rangeButtons[2]).toHaveTextContent("Schießstand München");
    });
  });

  describe("Modal height", () => {
    it("should use compact modal height for picker", async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ranges: mockRanges }),
      });

      render(<ShootingRangePicker onSelect={mockOnSelect} />);

      const triggerButton = screen.getByRole("button", { name: "Schießstand auswählen" });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByText("Schießstände werden geladen...")).not.toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog");
      const modalContent = dialog.querySelector(".bg-white");
      expect(modalContent).toHaveStyle({ maxHeight: "67.5vh" });
    });
  });
});

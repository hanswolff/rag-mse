import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "@/components/pagination";

describe("Pagination", () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there is only one page", () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={mockOnPageChange}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders pagination controls correctly", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByLabelText("Zurück")).toBeInTheDocument();
    expect(screen.getByLabelText("Weiter")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("highlights current page", () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    const currentPageButton = screen.getByText("3");
    expect(currentPageButton).toHaveClass("bg-brand-red-600", "text-white");
  });

  it("disables previous button on first page", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    const prevButton = screen.getByLabelText("Zurück");
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    const nextButton = screen.getByLabelText("Weiter");
    expect(nextButton).toBeDisabled();
  });

  it("calls onPageChange when clicking page numbers", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    fireEvent.click(screen.getByText("3"));
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange when clicking previous button", () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    fireEvent.click(screen.getByLabelText("Zurück"));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when clicking next button", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    fireEvent.click(screen.getByLabelText("Weiter"));
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it("does not call onPageChange when clicking disabled buttons", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    fireEvent.click(screen.getByLabelText("Zurück"));
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it("disables all controls when disabled prop is true", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
        disabled={true}
      />
    );

    expect(screen.getByLabelText("Zurück")).toBeDisabled();
    expect(screen.getByLabelText("Weiter")).toBeDisabled();

    fireEvent.click(screen.getByText("3"));
    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it("normalizes out-of-range current page for rendering and controls", () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={2}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByLabelText("Weiter")).toBeDisabled();
    const pageTwoButton = screen.getByLabelText("Seite 2");
    expect(pageTwoButton).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByLabelText("Zurück"));
    expect(mockOnPageChange).toHaveBeenCalledWith(1);
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Modal, DEFAULT_MODAL_MAX_HEIGHT } from "../components/modal";

describe("Modal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      render(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
      expect(screen.getByText("Modal content")).toBeInTheDocument();
    });

    it("should have correct ARIA attributes", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    });

    it("should render close button", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const closeButton = screen.getByLabelText("Schließen");
      expect(closeButton).toBeInTheDocument();
    });

    it("should render overlay backdrop", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const overlay = screen.getByRole("dialog").querySelector(".fixed.inset-0");
      expect(overlay).toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("should call onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const closeButton = screen.getByLabelText("Schließen");
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when Escape key is pressed", async () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when clicking outside modal", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const overlay = screen.getByRole("dialog").querySelector(".fixed.inset-0");
      expect(overlay).toBeInTheDocument();

      await user.click(overlay!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when clicking inside modal", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const modalContent = screen.getByText("Modal content");
      await user.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Body scroll lock", () => {
    it("should disable body scroll when modal is open", () => {
      const { rerender } = render(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("");

      rerender(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("should re-enable body scroll when modal is closed", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Cleanup", () => {
    it("should remove event listeners on unmount", () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Children rendering", () => {
    it("should render complex children", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <div>
            <h3>Section Title</h3>
            <p>Paragraph text</p>
            <button type="button">Action</button>
          </div>
        </Modal>
      );

      expect(screen.getByText("Section Title")).toBeInTheDocument();
      expect(screen.getByText("Paragraph text")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    });

    it("should render form elements", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <form>
            <input type="text" placeholder="Name" />
            <select>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
            <button type="submit">Submit</button>
          </form>
        </Modal>
      );

      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    });
  });

  describe("maxHeight prop", () => {
    it("should apply default maxHeight when not provided", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      const modalContent = dialog.querySelector(".bg-white");
      expect(modalContent).toHaveStyle({ maxHeight: DEFAULT_MODAL_MAX_HEIGHT });
    });

    it("should apply custom maxHeight when provided", () => {
      const customMaxHeight = "50vh";
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" maxHeight={customMaxHeight}>
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      const modalContent = dialog.querySelector(".bg-white");
      expect(modalContent).toHaveStyle({ maxHeight: customMaxHeight });
    });

    it("should apply empty string maxHeight when explicitly provided", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" maxHeight="">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      const modalContent = dialog.querySelector(".bg-white");
      expect(modalContent).toHaveStyle({ maxHeight: "" });
    });
  });

  describe("closeOnEscape prop", () => {
    it("should call onClose when Escape key is pressed and closeOnEscape is true", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnEscape={true}>
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when Escape key is pressed and closeOnEscape is false", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnEscape={false}>
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should call onClose when Escape key is pressed and closeOnEscape is not provided (default)", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("closeOnOutsideClick prop", () => {
    it("should call onClose when clicking outside modal and closeOnOutsideClick is true", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnOutsideClick={true}>
          <p>Modal content</p>
        </Modal>
      );

      const overlay = screen.getByRole("dialog").querySelector(".fixed.inset-0");
      expect(overlay).toBeInTheDocument();

      await user.click(overlay!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when clicking outside modal and closeOnOutsideClick is false", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnOutsideClick={false}>
          <p>Modal content</p>
        </Modal>
      );

      const overlay = screen.getByRole("dialog").querySelector(".fixed.inset-0");
      expect(overlay).toBeInTheDocument();

      await user.click(overlay!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should call onClose when clicking outside modal and closeOnOutsideClick is not provided (default)", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const overlay = screen.getByRole("dialog").querySelector(".fixed.inset-0");
      expect(overlay).toBeInTheDocument();

      await user.click(overlay!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when clicking inside modal regardless of closeOnOutsideClick", async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnOutsideClick={false}>
          <p>Modal content</p>
        </Modal>
      );

      const modalContent = screen.getByText("Modal content");
      await user.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Modal structure", () => {
    it("should have flex column layout with shrink-0 title area", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      const modalContent = dialog.querySelector(".bg-white");
      expect(modalContent).toHaveClass("flex", "flex-col");

      const titleArea = dialog.querySelector(".border-b");
      expect(titleArea).toHaveClass("shrink-0");
    });

    it("should have scrollable content area", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      const contentArea = dialog.querySelector(".overflow-y-auto");
      expect(contentArea).toBeInTheDocument();
    });

    it("should have smaller padding in title area", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      const titleArea = dialog.querySelector(".border-b");
      expect(titleArea).toHaveClass("p-3", "sm:p-4");
    });
  });
});

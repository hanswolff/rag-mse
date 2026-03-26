import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ConfirmDialogProvider, useConfirmDialog } from "../components/confirm-dialog";

function TestComponent({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirmDialog();

  return (
    <button
      onClick={async () => {
        const result = await confirm({
          message: "Wirklich löschen?",
          confirmLabel: "Löschen",
          cancelLabel: "Nein",
          variant: "danger",
        });
        onResult(result);
      }}
    >
      Trigger
    </button>
  );
}

function TestComponentWithDefaults({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirmDialog();

  return (
    <button
      onClick={async () => {
        const result = await confirm("Einfache Nachricht");
        onResult(result);
      }}
    >
      Trigger
    </button>
  );
}

describe("ConfirmDialog", () => {
  describe("useConfirmDialog", () => {
    it("should throw when used outside provider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      expect(() => {
        render(<TestComponent onResult={jest.fn()} />);
      }).toThrow("useConfirmDialog must be used within a ConfirmDialogProvider");
      spy.mockRestore();
    });
  });

  describe("Rendering", () => {
    it("should not render a dialog initially", () => {
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render a dialog when confirm is called", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Wirklich löschen?")).toBeInTheDocument();
    });

    it("should show custom confirm and cancel labels", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));

      expect(screen.getByText("Löschen")).toBeInTheDocument();
      expect(screen.getByText("Nein")).toBeInTheDocument();
    });

    it("should show default labels when using string shorthand", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialogProvider>
          <TestComponentWithDefaults onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));

      expect(screen.getByText("Einfache Nachricht")).toBeInTheDocument();
      expect(screen.getByText("Bestätigen")).toBeInTheDocument();
      expect(screen.getByText("Abbrechen")).toBeInTheDocument();
    });

    it("should show default title 'Bestätigung'", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialogProvider>
          <TestComponentWithDefaults onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));

      expect(screen.getByText("Bestätigung")).toBeInTheDocument();
    });
  });

  describe("Confirmation behavior", () => {
    it("should resolve true when confirm button is clicked", async () => {
      const user = userEvent.setup();
      const onResult = jest.fn();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={onResult} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));
      await user.click(screen.getByText("Löschen"));

      expect(onResult).toHaveBeenCalledWith(true);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should resolve false when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onResult = jest.fn();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={onResult} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));
      await user.click(screen.getByText("Nein"));

      expect(onResult).toHaveBeenCalledWith(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should resolve false when Escape key is pressed", async () => {
      const user = userEvent.setup();
      const onResult = jest.fn();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={onResult} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(onResult).toHaveBeenCalledWith(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Variant styling", () => {
    it("should use btn-danger class for danger variant", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));

      const confirmButton = screen.getByText("Löschen");
      expect(confirmButton).toHaveClass("btn-danger");
      expect(confirmButton).not.toHaveClass("btn-primary");
    });

    it("should use btn-primary class for default variant", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialogProvider>
          <TestComponentWithDefaults onResult={jest.fn()} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));

      const confirmButton = screen.getByText("Bestätigen");
      expect(confirmButton).toHaveClass("btn-primary");
      expect(confirmButton).not.toHaveClass("btn-danger");
    });
  });

  describe("Multiple sequential confirmations", () => {
    it("should handle sequential confirm calls correctly", async () => {
      const user = userEvent.setup();
      const onResult = jest.fn();
      render(
        <ConfirmDialogProvider>
          <TestComponent onResult={onResult} />
        </ConfirmDialogProvider>
      );

      await user.click(screen.getByText("Trigger"));
      await user.click(screen.getByText("Löschen"));
      expect(onResult).toHaveBeenCalledWith(true);

      onResult.mockClear();

      await user.click(screen.getByText("Trigger"));
      await user.click(screen.getByText("Nein"));
      expect(onResult).toHaveBeenCalledWith(false);
    });
  });
});

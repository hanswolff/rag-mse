import { render, screen, fireEvent, type RenderResult } from "@testing-library/react";
import type { ComponentType, ReactElement } from "react";
import "@testing-library/jest-dom";

export const UNSAVED_CHANGES_TEXT = "Sie haben ungespeicherte Änderungen. Wirklich schließen?";
export const GENERAL_ERROR_TEXT = "Ein allgemeiner Fehler ist aufgetreten";

/**
 * Baut einen Renderer für ein Formular-Modal: rendert die Komponente mit den
 * Default-Props der Suite und beliebigen Überschreibungen pro Test.
 */
export function createModalRenderer<P extends object>(
  Component: ComponentType<P>,
  getDefaultProps: () => NoInfer<P>
) {
  const buildProps = (overrides: Partial<P> = {}): P => ({ ...getDefaultProps(), ...overrides });

  const renderModal = (overrides: Partial<P> = {}): RenderResult =>
    render(<Component {...buildProps(overrides)} />);

  const modalElement = (overrides: Partial<P> = {}): ReactElement => (
    <Component {...buildProps(overrides)} />
  );

  return { renderModal, modalElement };
}

export function clickCancel() {
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
}

export function expectUnsavedChangesConfirm() {
  expect(screen.getByText(UNSAVED_CHANGES_TEXT)).toBeInTheDocument();
}

export function expectNoUnsavedChangesConfirm() {
  expect(screen.queryByText(UNSAVED_CHANGES_TEXT)).not.toBeInTheDocument();
}

/** ConfirmCloseModal ist sichtbar; dessen "Abbrechen" schließt nur den Bestätigungsdialog. */
export function dismissUnsavedChangesConfirm() {
  const abortButtons = screen.getAllByRole("button", { name: "Abbrechen" });
  fireEvent.click(abortButtons[abortButtons.length - 1]);
}

interface CommonFormModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  errors?: Record<string, string>;
}

interface SharedFormModalTestOptions<P extends CommonFormModalProps> {
  renderModal: (overrides?: Partial<P>) => RenderResult;
  onClose: jest.Mock;
  onSubmit: jest.Mock;
  /** Edit-Modus mit abweichenden Formulardaten (ungespeicherte Änderungen). */
  dirtyEditProps: Partial<P>;
  /** Edit-Modus, Formulardaten identisch mit den Initialdaten. */
  cleanEditProps: Partial<P>;
  /** Labels aller Eingabefelder, die bei isSubmitting deaktiviert sein müssen. */
  disabledWhenSubmitting: (RegExp | string)[];
  /** Wie die Abwesenheit des allgemeinen Fehlers geprüft wird. */
  generalErrorAbsenceQuery?: "alert-role" | "text";
}

/**
 * Verhaltens-Suite, die in allen FormModal-basierten Modals identisch ist:
 * Ungespeicherte-Änderungen-Dialog, Disabled-State, allgemeiner Fehler-Header,
 * nicht gerendert bei isOpen=false, Abbrechen ohne Submit.
 */
export function includeSharedFormModalTests<P extends CommonFormModalProps>({
  renderModal,
  onClose,
  onSubmit,
  dirtyEditProps,
  cleanEditProps,
  disabledWhenSubmitting,
  generalErrorAbsenceQuery = "text",
}: SharedFormModalTestOptions<P>) {
  describe("Unsaved Changes Confirmation", () => {
    it("should show confirmation dialog when closing with unsaved changes", () => {
      renderModal(dirtyEditProps);
      clickCancel();
      expectUnsavedChangesConfirm();
    });

    it("should close modal without confirmation when no unsaved changes", () => {
      renderModal(cleanEditProps);
      clickCancel();
      expectNoUnsavedChangesConfirm();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should not close when user cancels confirmation dialog", () => {
      renderModal(dirtyEditProps);
      clickCancel();
      dismissUnsavedChangesConfirm();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("should disable all inputs when isSubmitting is true", () => {
      renderModal({ isSubmitting: true } as Partial<P>);
      for (const label of disabledWhenSubmitting) {
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
    });

    it("should show 'Wird gespeichert…' text when isSubmitting is true", () => {
      renderModal({ isSubmitting: true } as Partial<P>);
      expect(screen.getByText("Wird gespeichert…")).toBeInTheDocument();
    });

    it("should disable submit button when isSubmitting is true", () => {
      renderModal({ isSubmitting: true } as Partial<P>);
      expect(screen.getByRole("button", { name: "Wird gespeichert…" })).toBeDisabled();
    });

    it("should disable cancel button when isSubmitting is true", () => {
      renderModal({ isSubmitting: true } as Partial<P>);
      expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
    });
  });

  describe("General Errors", () => {
    it("should display general error when errors.general is provided", () => {
      renderModal({ errors: { general: GENERAL_ERROR_TEXT } } as unknown as Partial<P>);
      expect(screen.getByText(GENERAL_ERROR_TEXT)).toBeInTheDocument();
    });

    it("should not display general error when errors.general is not provided", () => {
      renderModal({ errors: {} } as Partial<P>);
      if (generalErrorAbsenceQuery === "alert-role") {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      } else {
        expect(screen.queryByText(GENERAL_ERROR_TEXT)).not.toBeInTheDocument();
      }
    });
  });

  describe("Not Rendered When Closed", () => {
    it("should not render when isOpen is false", () => {
      renderModal({ isOpen: false } as Partial<P>);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Button Actions", () => {
    it("should not call onSubmit when cancel button is clicked", () => {
      renderModal(cleanEditProps);
      clickCancel();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
}

"use client";

import type { ReactNode } from "react";
import { Modal } from "./modal";
import { AlertBox } from "./alert-box";
import { ConfirmCloseModal } from "./confirm-close-modal";
import { LoadingButton } from "./loading-button";
import { useFormModal, type UseFormModalOptions } from "@/lib/use-form-modal";

export type FormModalRenderProps<T extends object> = ReturnType<typeof useFormModal<T>>;

interface FormModalProps<T extends object>
  extends Omit<UseFormModalOptions<T>, "onClose" | "onSubmit"> {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
  submitLabel: string;
  submittingLabel?: string;
  /** "split": zwei volle Buttons nebeneinander (Standard); "end": rechtsbündig mit Trennlinie. */
  footerVariant?: "split" | "end";
  children: (form: FormModalRenderProps<T>) => ReactNode;
}

/**
 * Gemeinsames Gerüst der Formular-Modals: Modal + <form> + Fehler-Header +
 * Footer (Abbrechen + LoadingButton) + ConfirmCloseModal, intern auf
 * useFormModal. Die Felder liefert der Aufrufer als Render-Prop und erhält
 * dafür die useFormModal-Helfer (handleChange, getFieldError, …).
 */
export function FormModal<T extends object>({
  title,
  size = "lg",
  submitLabel,
  submittingLabel = "Wird gespeichert…",
  footerVariant = "split",
  children,
  ...formOptions
}: FormModalProps<T>) {
  const form = useFormModal<T>(formOptions);
  const { isOpen, isSubmitting, serverErrors = {} } = formOptions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={form.handleClose}
      title={title}
      size={size}
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={form.handleSubmit} className="space-y-4" noValidate>
        {Object.keys(form.generalErrors).length === 0 && (
          <AlertBox type="error" message={serverErrors.general} />
        )}
        {children(form)}
        {footerVariant === "split" ? (
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={form.handleClose}
              disabled={isSubmitting}
              className="flex-1 btn-outline py-2.5 text-base touch-manipulation"
            >
              Abbrechen
            </button>
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              loadingText={submittingLabel}
              className="flex-1 btn-primary py-2.5 text-base touch-manipulation"
            >
              {submitLabel}
            </LoadingButton>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={form.handleClose}
              disabled={isSubmitting}
              className="btn-outline"
            >
              Abbrechen
            </button>
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              loadingText={submittingLabel}
              className="btn-primary"
            >
              {submitLabel}
            </LoadingButton>
          </div>
        )}
      </form>
      <ConfirmCloseModal
        isOpen={form.showCloseConfirm}
        onConfirm={form.handleConfirmClose}
        onCancel={form.cancelClose}
      />
    </Modal>
  );
}

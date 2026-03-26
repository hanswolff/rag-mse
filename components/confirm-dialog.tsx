"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal } from "./modal";

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

type ConfirmFn = (options: ConfirmDialogOptions | string) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export function useConfirmDialog(): ConfirmFn {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) {
    throw new Error("useConfirmDialog must be used within a ConfirmDialogProvider");
  }
  return confirm;
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: "danger" | "warning" | "default";
}

const DEFAULT_STATE: DialogState = {
  isOpen: false,
  title: "Bestätigung",
  message: "",
  confirmLabel: "Bestätigen",
  cancelLabel: "Abbrechen",
  variant: "default",
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(DEFAULT_STATE);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === "string" ? { message: options } : options;

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        isOpen: true,
        title: opts.title ?? "Bestätigung",
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? "Bestätigen",
        cancelLabel: opts.cancelLabel ?? "Abbrechen",
        variant: opts.variant ?? "default",
      });
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const confirmButtonClass = dialog.variant === "danger" ? "btn-danger" : "btn-primary";

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={dialog.isOpen}
        onClose={() => handleClose(false)}
        title={dialog.title}
        size="sm"
      >
        <p className="text-gray-700 mb-6">{dialog.message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="btn-outline"
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => handleClose(true)}
            className={confirmButtonClass}
            autoFocus
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

"use client";

import { Modal } from "./modal";

interface ConfirmCloseModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCloseModal({ isOpen, onConfirm, onCancel }: ConfirmCloseModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Ungespeicherte Änderungen" size="sm">
      <p className="text-gray-700 mb-6">
        Sie haben ungespeicherte Änderungen. Wirklich schließen?
      </p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-outline">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-primary"
          autoFocus
        >
          Schließen
        </button>
      </div>
    </Modal>
  );
}

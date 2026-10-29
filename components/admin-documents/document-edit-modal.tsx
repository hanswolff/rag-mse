"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { ConfirmCloseModal } from "@/components/confirm-close-modal";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { AlertBox } from "@/components/alert-box";
import { useFormModal } from "@/lib/use-form-modal";
import { mapServerErrorToField, DOCUMENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { documentValidationConfig } from "@/lib/validation-schema";
import { formatDateOnlyForInput } from "@/lib/dates";
import type { DirectoryFilter } from "@/lib/document-utils";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

interface DocumentEditFormData {
  displayName: string;
  documentDate: string;
  directoryId: DirectoryFilter;
}

type EditableField = keyof DocumentEditFormData;

const emptyFormData: DocumentEditFormData = {
  displayName: "",
  documentDate: "",
  directoryId: "root",
};

function toFormData(document: DocumentItem | null): DocumentEditFormData {
  if (!document) return emptyFormData;
  return {
    displayName: document.displayName,
    documentDate: formatDateOnlyForInput(document.documentDate),
    directoryId: document.directoryId || "root",
  };
}

interface DocumentEditModalProps {
  isOpen: boolean;
  document: DocumentItem | null;
  directories: DocumentDirectoryItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function DocumentEditModal({ isOpen, document, directories, onClose, onSaved }: DocumentEditModalProps) {
  const [formData, setFormData] = useState<DocumentEditFormData>(emptyFormData);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const initialData = useMemo(() => toFormData(document), [document]);

  useEffect(() => {
    setFormData(toFormData(document));
    setServerErrors({});
    setIsSaving(false);
  }, [document, isOpen]);

  // preventDefault und Feld-Validierung übernimmt useFormModal.handleSubmit
  const submitEdit = async () => {
    if (!document) return;

    setServerErrors({});
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName,
          documentDate: formData.documentDate,
          directoryId: formData.directoryId === "root" ? null : formData.directoryId,
        }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string; fieldErrors?: Array<{ field: string; message: string }> };

      if (!response.ok) {
        const message = payload.error || "Dokument konnte nicht aktualisiert werden";
        const fieldErrorMap = mapServerErrorToField(message, DOCUMENT_FIELD_KEYWORDS, payload.fieldErrors);
        setServerErrors(Object.keys(fieldErrorMap).length > 0 ? fieldErrorMap : { general: message });
        setIsSaving(false);
        return;
      }

      onClose();
      await onSaved();
    } catch (updateError: unknown) {
      setServerErrors({
        general: updateError instanceof Error ? updateError.message : "Dokument konnte nicht aktualisiert werden",
      });
      setIsSaving(false);
    }
  };

  const {
    getFieldError,
    handleChange,
    handleBlur,
    handleClose,
    handleSubmit,
    generalErrors,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
    isValidAndTouched,
  } = useFormModal<DocumentEditFormData>({
    validationConfig: documentValidationConfig,
    formData,
    setFormData,
    initialData,
    isOpen,
    isSubmitting: isSaving,
    onClose,
    onSubmit: () => {
      void submitEdit();
    },
    serverErrors,
    fieldKeywords: DOCUMENT_FIELD_KEYWORDS,
  });

  // Serverfehler des Feldes (und die allgemeine Meldung) verschwinden,
  // sobald der Wert geändert wird
  const handleFieldChange = (name: EditableField, value: string) => {
    setServerErrors((prev) => {
      if (!prev[name] && !prev.general) return prev;
      const next = { ...prev };
      delete next[name];
      delete next.general;
      return next;
    });
    handleChange(name, value);
  };

  // Während des Speicherns bleibt das Modal geschlossen für Schließversuche
  const requestClose = () => {
    if (isSaving) return;
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title="Dokument bearbeiten"
      size="lg"
      contentOverflow="visible"
      closeOnOutsideClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {Object.keys(generalErrors).length === 0 && (
          <AlertBox type="error" message={serverErrors.general} />
        )}
        <ValidatedFieldGroup
          id="edit-display-name"
          label="Dokumentenname"
          name="displayName"
          type="text"
          value={formData.displayName}
          onChange={(event) => handleFieldChange("displayName", event.target.value)}
          onBlur={(event) => handleBlur("displayName", event.target.value)}
          required
          maxLength={200}
          autoFocus
          disabled={isSaving}
          error={getFieldError("displayName")}
          showSuccess={isValidAndTouched("displayName", formData.displayName)}
        />

        <GermanDatePicker
          id="edit-document-date"
          value={formData.documentDate || null}
          onChange={(nextDate) => handleFieldChange("documentDate", nextDate)}
          onBlur={() => handleBlur("documentDate", formData.documentDate)}
          label="Dokumentdatum"
          error={getFieldError("documentDate")}
          showSuccess={isValidAndTouched("documentDate", formData.documentDate)}
          disabled={isSaving}
        />

        <div>
          <label htmlFor="edit-document-directory" className="form-label">Verzeichnis</label>
          <select
            id="edit-document-directory"
            className="form-select"
            value={formData.directoryId}
            onChange={(event) => handleFieldChange("directoryId", event.target.value)}
            onBlur={(event) => handleBlur("directoryId", event.target.value)}
            disabled={isSaving}
          >
            <option value="root">/</option>
            {directories.map((directory) => (
              <option key={directory.id} value={directory.id}>
                {directory.name}
              </option>
            ))}
          </select>
          {getFieldError("directoryId") && (
            <p className="text-sm text-red-700 mt-1">{getFieldError("directoryId")}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline px-4 py-2 text-base" onClick={requestClose} disabled={isSaving}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary px-4 py-2 text-base" disabled={isSaving}>
            {isSaving ? "Wird gespeichert…" : "Speichern"}
          </button>
        </div>
      </form>
      <ConfirmCloseModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={cancelClose}
      />
    </Modal>
  );
}

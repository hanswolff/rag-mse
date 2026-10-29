"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Permissions } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { ConfirmCloseModal } from "@/components/confirm-close-modal";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { GermanDatePicker } from "@/components/german-date-picker";
import { LoadingScreen } from "@/components/loading-screen";
import { LoadingIndicator } from "@/components/loading-indicator";
import { PdfViewerLazy } from "@/components/pdf-viewer-lazy";
import { VisibilityBadge } from "@/components/visibility-badge";
import { VisibilitySelect } from "@/components/visibility-select";
import { useFormModal } from "@/lib/use-form-modal";
import { apiFetch } from "@/lib/api-fetch";
import { formatFileSize } from "@/lib/document-utils";
import { formatDateUtc } from "@/lib/dates";
import { API_ROUTES } from "@/lib/api-routes";
import { isAusschreibungCurrent } from "@/lib/ausschreibung-validation";
import { Visibility } from "@/lib/visibility";
import type { AusschreibungItem, NewAusschreibungInput } from "@/types";

const ADMIN_API = API_ROUTES.ADMIN.AUSSCHREIBUNGEN;

function isCurrent(expiresAt: string): boolean {
  return isAusschreibungCurrent(new Date(expiresAt));
}

const EMPTY_FORM: NewAusschreibungInput = {
  title: "",
  description: "",
  expiresAt: "",
  visibility: Visibility.PUBLIC,
  file: null,
};

function toFormData(form: NewAusschreibungInput): FormData {
  const formData = new FormData();
  formData.set("title", form.title);
  formData.set("description", form.description);
  formData.set("expiresAt", form.expiresAt);
  formData.set("visibility", form.visibility);
  if (form.file) {
    formData.set("file", form.file);
  }
  return formData;
}

// Gemeinsame Formularfelder für Anlage und Bearbeitung einer Ausschreibung.
function AusschreibungFormFields({
  variant,
  form,
  setForm,
  disabled,
  fileInputRef,
}: {
  variant: "create" | "edit";
  form: NewAusschreibungInput;
  setForm: (updater: (prev: NewAusschreibungInput) => NewAusschreibungInput) => void;
  disabled: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const idPrefix = variant === "edit" ? "edit-ausschreibung" : "ausschreibung";

  const dateField = (
    <div>
      <GermanDatePicker
        id={`${idPrefix}-expires-at`}
        value={form.expiresAt || null}
        onChange={(date) => setForm((prev) => ({ ...prev, expiresAt: date }))}
        label="Ablaufdatum (Anzeigen bis)"
        required
        disabled={disabled}
      />
      <p className="form-help">Vorschlag: das Veranstaltungsdatum. Frei wählbar.</p>
    </div>
  );

  const visibilityField = (
    <VisibilitySelect
      id={`${idPrefix}-visibility`}
      value={form.visibility}
      onChange={(visibility) => setForm((prev) => ({ ...prev, visibility }))}
      disabled={disabled}
      help="Verborgene Ausschreibungen sind auch über den direkten Link zum PDF nicht mehr abrufbar."
    />
  );

  const fileField = (
    <div>
      <label htmlFor={`${idPrefix}-file`} className="form-label">
        {variant === "edit" ? "PDF ersetzen (optional)" : "PDF-Datei"}
      </label>
      <input
        id={`${idPrefix}-file`}
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="form-input"
        onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
        disabled={disabled}
      />
    </div>
  );

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-title`} className="form-label">Titel</label>
        <input
          id={`${idPrefix}-title`}
          type="text"
          className="form-input"
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          maxLength={200}
          required
          disabled={disabled}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-description`} className="form-label">Beschreibung (optional)</label>
        <textarea
          id={`${idPrefix}-description`}
          className="form-input"
          rows={3}
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          disabled={disabled}
        />
      </div>

      {variant === "create" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dateField}
            {fileField}
          </div>
          {visibilityField}
        </>
      ) : (
        <>
          {dateField}
          {visibilityField}
          {fileField}
        </>
      )}
    </>
  );
}

// Bearbeiten-Modal mit Dirty-/Close-Logik aus useFormModal statt Handbau.
function AusschreibungEditModal({
  ausschreibung,
  form,
  setForm,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  ausschreibung: AusschreibungItem | null;
  form: NewAusschreibungInput;
  setForm: React.Dispatch<React.SetStateAction<NewAusschreibungInput>>;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const initialData = useMemo<NewAusschreibungInput | undefined>(
    () =>
      ausschreibung
        ? {
            title: ausschreibung.title,
            description: ausschreibung.description || "",
            expiresAt: ausschreibung.expiresAt.slice(0, 10),
            visibility: ausschreibung.visibility,
            file: null,
          }
        : undefined,
    [ausschreibung]
  );

  const {
    handleClose,
    handleSubmit,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
  } = useFormModal<NewAusschreibungInput>({
    validationConfig: {},
    formData: form,
    setFormData: setForm,
    initialData,
    isOpen: ausschreibung !== null,
    isSubmitting: isSaving,
    onClose,
    onSubmit,
  });

  return (
    <>
      <Modal
        isOpen={ausschreibung !== null}
        onClose={handleClose}
        title="Ausschreibung bearbeiten"
        size="lg"
        closeOnOutsideClick={false}
        closeOnEscape={false}
      >
        {ausschreibung && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <AusschreibungFormFields variant="edit" form={form} setForm={setForm} disabled={isSaving} />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-outline" onClick={handleClose} disabled={isSaving}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? "Wird gespeichert…" : "Speichern"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmCloseModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={cancelClose}
      />
    </>
  );
}

export function AdminAusschreibungManager() {
  const { data: session, status } = useSession();
  const confirm = useConfirmDialog();

  const [ausschreibungen, setAusschreibungen] = useState<AusschreibungItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [uploadForm, setUploadForm] = useState<NewAusschreibungInput>(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<AusschreibungItem | null>(null);
  const [editForm, setEditForm] = useState<NewAusschreibungInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [viewing, setViewing] = useState<AusschreibungItem | null>(null);

  const canManage = Permissions.canManageAusschreibungen(session?.user);

  const loadAusschreibungen = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const data = await apiFetch<{ ausschreibungen: AusschreibungItem[] }>(ADMIN_API, {
        fallbackError: "Ausschreibungen konnten nicht geladen werden",
      });
      setAusschreibungen(data.ausschreibungen);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ausschreibungen konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "loading") {
      void loadAusschreibungen();
    }
  }, [status, loadAusschreibungen]);

  const sorted = useMemo(
    () => [...ausschreibungen].sort((a, b) => b.expiresAt.localeCompare(a.expiresAt)),
    [ausschreibungen]
  );

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");

    if (!uploadForm.file) {
      setUploadError("Datei ist erforderlich");
      return;
    }

    setIsUploading(true);
    try {
      const created = await apiFetch<AusschreibungItem>(ADMIN_API, {
        method: "POST",
        body: toFormData(uploadForm),
        fallbackError: "Ausschreibung konnte nicht angelegt werden",
      });

      setUploadForm(EMPTY_FORM);
      // Das File-Input ist unkontrolliert — ohne Reset zeigt die nächste Anlage
      // den alten Dateinamen an, meldet aber "Datei ist erforderlich".
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = "";
      }
      setAusschreibungen((prev) => [...prev, created]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Ausschreibung konnte nicht angelegt werden");
    } finally {
      setIsUploading(false);
    }
  }

  function openEdit(ausschreibung: AusschreibungItem) {
    setEditing(ausschreibung);
    setEditForm({
      title: ausschreibung.title,
      description: ausschreibung.description || "",
      expiresAt: ausschreibung.expiresAt.slice(0, 10),
      visibility: ausschreibung.visibility,
      file: null,
    });
    setEditError("");
  }

  function closeEdit() {
    setEditing(null);
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;

    setIsSaving(true);
    setEditError("");
    try {
      const updated = await apiFetch<AusschreibungItem>(`${ADMIN_API}/${editing.id}`, {
        method: "PATCH",
        body: toFormData(editForm),
        fallbackError: "Ausschreibung konnte nicht gespeichert werden",
      });

      setEditing(null);
      setAusschreibungen((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Ausschreibung konnte nicht gespeichert werden");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(ausschreibung: AusschreibungItem) {
    const confirmed = await confirm({
      title: "Ausschreibung löschen",
      message: `Soll die Ausschreibung "${ausschreibung.title}" wirklich endgültig gelöscht werden?`,
      confirmLabel: "Löschen",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await apiFetch(`${ADMIN_API}/${ausschreibung.id}`, {
        method: "DELETE",
        fallbackError: "Ausschreibung konnte nicht gelöscht werden",
      });
      setAusschreibungen((prev) => prev.filter((item) => item.id !== ausschreibung.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ausschreibung konnte nicht gelöscht werden");
    }
  }

  if (status === "loading") {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ausschreibungen verwalten</h1>
          <p className="text-base text-gray-600 mt-2">
            Bekanntmachungen externer Wettbewerbe und Veranstaltungen anlegen, bearbeiten und löschen.
          </p>
        </div>

        {canManage && (
          <section className="card-compact mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Neue Ausschreibung anlegen</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <AusschreibungFormFields
                variant="create"
                form={uploadForm}
                setForm={setUploadForm}
                disabled={isUploading}
                fileInputRef={uploadFileInputRef}
              />

              {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}

              <button type="submit" className="btn-primary px-4 py-2 text-base" disabled={isUploading}>
                {isUploading ? "Wird hochgeladen…" : "Ausschreibung anlegen"}
              </button>
            </form>
          </section>
        )}

        {loadError && <p className="text-red-600 text-sm mb-4">{loadError}</p>}

        {isLoading ? (
          <LoadingIndicator size="md" className="text-gray-400" />
        ) : sorted.length === 0 ? (
          <div className="card empty-state">
            <p className="text-gray-500 text-base sm:text-lg font-medium">Keine Ausschreibungen vorhanden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((ausschreibung) => (
              <div key={ausschreibung.id} className="card-compact flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{ausschreibung.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isCurrent(ausschreibung.expiresAt) ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {isCurrent(ausschreibung.expiresAt) ? "Aktuell" : "Historisch"}
                    </span>
                    <VisibilityBadge visibility={ausschreibung.visibility} showPublic />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Anzeigen bis {formatDateUtc(ausschreibung.expiresAt)} · {formatFileSize(ausschreibung.sizeBytes)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setViewing(ausschreibung)}>
                    Ansehen
                  </button>
                  {canManage && (
                    <>
                      <button type="button" className="btn-outline text-sm" onClick={() => openEdit(ausschreibung)}>
                        Bearbeiten
                      </button>
                      <button type="button" className="btn-danger text-sm" onClick={() => handleDelete(ausschreibung)}>
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? viewing.title : "Ausschreibung ansehen"}
        size="full"
      >
        {viewing && <PdfViewerLazy source={`${ADMIN_API}/${viewing.id}/file`} />}
      </Modal>

      <AusschreibungEditModal
        ausschreibung={editing}
        form={editForm}
        setForm={setEditForm}
        isSaving={isSaving}
        error={editError}
        onClose={closeEdit}
        onSubmit={handleSaveEdit}
      />
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { Permissions } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { GermanDatePicker } from "@/components/german-date-picker";
import { LoadingScreen } from "@/components/loading-screen";
import { LoadingIndicator } from "@/components/loading-indicator";
import { formatDateUtc, formatFileSize } from "@/lib/document-utils";
import { API_ROUTES } from "@/lib/api-routes";
import { isAusschreibungCurrent } from "@/lib/ausschreibung-validation";
import type { AusschreibungItem } from "@/types";

const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
      <LoadingIndicator size="md" className="text-gray-400" />
      <span>PDF wird geladen…</span>
    </div>
  ),
});

const ADMIN_API = API_ROUTES.ADMIN.AUSSCHREIBUNGEN;

function isCurrent(expiresAt: string): boolean {
  return isAusschreibungCurrent(new Date(expiresAt));
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

interface FormState {
  title: string;
  description: string;
  expiresAt: string;
  file: File | null;
}

const EMPTY_FORM: FormState = { title: "", description: "", expiresAt: "", file: null };

export function AdminAusschreibungManager() {
  const { data: session, status } = useSession();
  const confirm = useConfirmDialog();

  const [ausschreibungen, setAusschreibungen] = useState<AusschreibungItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [uploadForm, setUploadForm] = useState<FormState>(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<AusschreibungItem | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [viewing, setViewing] = useState<AusschreibungItem | null>(null);

  const canManage = Permissions.canManageAusschreibungen(session?.user);

  const loadAusschreibungen = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch(ADMIN_API);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Ausschreibungen konnten nicht geladen werden"));
      }
      const data = await response.json();
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
      const formData = new FormData();
      formData.set("title", uploadForm.title);
      formData.set("description", uploadForm.description);
      formData.set("expiresAt", uploadForm.expiresAt);
      formData.set("file", uploadForm.file);

      const response = await fetch(ADMIN_API, { method: "POST", body: formData });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Ausschreibung konnte nicht angelegt werden"));
      }
      const created: AusschreibungItem = await response.json();

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
      file: null,
    });
    setEditError("");
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setIsSaving(true);
    setEditError("");
    try {
      const formData = new FormData();
      formData.set("title", editForm.title);
      formData.set("description", editForm.description);
      formData.set("expiresAt", editForm.expiresAt);
      if (editForm.file) {
        formData.set("file", editForm.file);
      }

      const response = await fetch(`${ADMIN_API}/${editing.id}`, { method: "PATCH", body: formData });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Ausschreibung konnte nicht gespeichert werden"));
      }
      const updated: AusschreibungItem = await response.json();

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
      const response = await fetch(`${ADMIN_API}/${ausschreibung.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Ausschreibung konnte nicht gelöscht werden"));
      }
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
            Öffentliche Bekanntmachungen externer Wettbewerbe und Veranstaltungen anlegen, bearbeiten und löschen.
          </p>
        </div>

        {canManage && (
          <section className="card-compact mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Neue Ausschreibung anlegen</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label htmlFor="ausschreibung-title" className="form-label">Titel</label>
                <input
                  id="ausschreibung-title"
                  type="text"
                  className="form-input"
                  value={uploadForm.title}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, title: event.target.value }))}
                  maxLength={200}
                  required
                  disabled={isUploading}
                />
              </div>

              <div>
                <label htmlFor="ausschreibung-description" className="form-label">Beschreibung (optional)</label>
                <textarea
                  id="ausschreibung-description"
                  className="form-input"
                  rows={3}
                  value={uploadForm.description}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={isUploading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <GermanDatePicker
                    id="ausschreibung-expires-at"
                    value={uploadForm.expiresAt || null}
                    onChange={(date) => setUploadForm((prev) => ({ ...prev, expiresAt: date }))}
                    label="Ablaufdatum (Anzeigen bis)"
                    required
                    disabled={isUploading}
                  />
                  <p className="form-help">Vorschlag: das Veranstaltungsdatum. Frei wählbar.</p>
                </div>

                <div>
                  <label htmlFor="ausschreibung-file" className="form-label">PDF-Datei</label>
                  <input
                    id="ausschreibung-file"
                    ref={uploadFileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="form-input"
                    onChange={(event) => setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                    disabled={isUploading}
                  />
                </div>
              </div>

              {uploadError && <p className="text-red-600 text-sm">{uploadError}</p>}

              <button type="submit" className="btn-primary px-4 py-2 text-base" disabled={isUploading}>
                {isUploading ? "Wird hochgeladen..." : "Ausschreibung anlegen"}
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
        size="4xl"
      >
        {viewing && <PdfViewer source={`${API_ROUTES.AUSSCHREIBUNGEN}/${viewing.id}/file`} />}
      </Modal>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title="Ausschreibung bearbeiten"
        size="lg"
        closeOnOutsideClick={false}
        closeOnEscape={false}
      >
        {editing && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label htmlFor="edit-ausschreibung-title" className="form-label">Titel</label>
              <input
                id="edit-ausschreibung-title"
                type="text"
                className="form-input"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={200}
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="edit-ausschreibung-description" className="form-label">Beschreibung (optional)</label>
              <textarea
                id="edit-ausschreibung-description"
                className="form-input"
                rows={3}
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                disabled={isSaving}
              />
            </div>

            <div>
              <GermanDatePicker
                id="edit-ausschreibung-expires-at"
                value={editForm.expiresAt || null}
                onChange={(date) => setEditForm((prev) => ({ ...prev, expiresAt: date }))}
                label="Ablaufdatum (Anzeigen bis)"
                required
                disabled={isSaving}
              />
              <p className="form-help">Vorschlag: das Veranstaltungsdatum. Frei wählbar.</p>
            </div>

            <div>
              <label htmlFor="edit-ausschreibung-file" className="form-label">PDF ersetzen (optional)</label>
              <input
                id="edit-ausschreibung-file"
                type="file"
                accept="application/pdf"
                className="form-input"
                onChange={(event) => setEditForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                disabled={isSaving}
              />
            </div>

            {editError && <p className="text-red-600 text-sm">{editError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)} disabled={isSaving}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? "Wird gespeichert..." : "Speichern"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}

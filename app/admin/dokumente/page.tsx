"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackLink } from "@/components/back-link";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { SearchHighlight } from "@/components/search-highlight";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { formatDate } from "@/lib/date-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { isAdmin } from "@/lib/role-utils";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToField, DOCUMENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { documentValidationConfig } from "@/lib/validation-schema";
import type { DocumentItem } from "@/types";

type DocumentsResponse = {
  documents: DocumentItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  uploadConstraints?: {
    maxUploadMb: number;
  };
};

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isViewableDocument(document: DocumentItem): boolean {
  return document.mimeType === "application/pdf" || document.mimeType.startsWith("image/");
}

function formatDateForInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default function AdminDocumentsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadDocumentDate, setUploadDocumentDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [maxUploadMb, setMaxUploadMb] = useState(15);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDocumentDate, setEditDocumentDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<DocumentItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {
    errors: editValidationErrors,
    validateField: validateEditField,
    validateAllFields: validateAllEditFields,
    markFieldAsTouched: markEditFieldAsTouched,
    shouldShowError: shouldShowEditError,
    isValidAndTouched: isEditValidAndTouched,
    reset: resetEditValidation,
  } = useFormFieldValidation(documentValidationConfig);
  const showMobileCards =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches;

  const inferredEditGeneralErrors = useMemo(() => {
    return mapServerErrorToField(editErrors.general || "", DOCUMENT_FIELD_KEYWORDS);
  }, [editErrors.general]);

  const combinedEditErrors = useMemo(() => {
    return { ...editValidationErrors, ...inferredEditGeneralErrors, ...editErrors };
  }, [editValidationErrors, inferredEditGeneralErrors, editErrors]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  const loadDocuments = useCallback(async (targetPage: number, query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      });

      if (query.trim().length > 0) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/admin/documents?${params.toString()}`);
      const data = (await response.json()) as DocumentsResponse | { error?: string };

      if (!response.ok) {
        const errorMessage =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Dokumente konnten nicht geladen werden";
        throw new Error(errorMessage);
      }

      const payload = data as DocumentsResponse;
      setDocuments(payload.documents);
      setTotal(payload.pagination.total);
      setPage(payload.pagination.page);
      setTotalPages(payload.pagination.pages);
      if (payload.uploadConstraints?.maxUploadMb && payload.uploadConstraints.maxUploadMb > 0) {
        setMaxUploadMb(payload.uploadConstraints.maxUploadMb);
      }
    } catch (loadError: unknown) {
      setDocuments([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Dokumente konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session || !isAdmin(session.user)) {
      return;
    }

    void loadDocuments(page, searchQuery);
  }, [status, session, page, searchQuery, loadDocuments]);

  const handleSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedFile) {
      setError("Bitte wählen Sie eine Datei aus.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("displayName", uploadDisplayName);
      formData.append("documentDate", uploadDocumentDate);

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) {
          return;
        }
        const nextProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setUploadProgress(nextProgress);
      };

      xhr.onreadystatechange = async () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return;
        }

        try {
          const payload = xhr.responseText ? JSON.parse(xhr.responseText) as { error?: string } : {};
          if (xhr.status < 200 || xhr.status >= 300) {
            throw new Error(payload.error || "Upload fehlgeschlagen");
          }

          setSuccess("Dokument wurde erfolgreich hochgeladen.");
          setSelectedFile(null);
          setUploadDisplayName("");
          setUploadDocumentDate("");

          const fileInput = document.getElementById("document-file") as HTMLInputElement | null;
          if (fileInput) {
            fileInput.value = "";
          }

          setPage(1);
          await loadDocuments(1, searchQuery);
        } catch (uploadError: unknown) {
          setError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen");
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
          resolve();
        }
      };

      xhr.open("POST", "/api/admin/documents");
      xhr.send(formData);
    });
  };

  const handleDelete = async (document: DocumentItem) => {
    setError(null);
    setSuccess(null);

    if (!confirm(`Soll das Dokument \"${document.displayName}\" wirklich gelöscht werden?`)) {
      return;
    }

    setDeletingId(document.id);

    try {
      const response = await fetch(`/api/admin/documents/${document.id}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Dokument konnte nicht gelöscht werden");
      }

      setSuccess("Dokument wurde gelöscht.");
      await loadDocuments(page, searchQuery);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Dokument konnte nicht gelöscht werden");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (document: DocumentItem) => {
    setEditingDocument(document);
    setEditDisplayName(document.displayName);
    setEditDocumentDate(formatDateForInput(document.documentDate));
    setEditErrors({});
    resetEditValidation();
    setIsEditModalOpen(true);
    setError(null);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingDocument(null);
    setEditDisplayName("");
    setEditDocumentDate("");
    setEditErrors({});
    resetEditValidation();
    setIsSavingEdit(false);
  };

  const handleEditFieldChange = (name: "displayName" | "documentDate", value: string) => {
    if (name === "displayName") {
      setEditDisplayName(value);
    } else {
      setEditDocumentDate(value);
    }

    setEditErrors((prev) => ({ ...prev, [name]: "", general: "" }));

    if (editValidationErrors[name]) {
      validateEditField(name, value);
    }
  };

  const handleEditFieldBlur = (name: "displayName" | "documentDate", value: string) => {
    markEditFieldAsTouched(name);
    validateEditField(name, value);
  };

  const getEditFieldError = (fieldName: "displayName" | "documentDate"): string | undefined => {
    if (editErrors[fieldName]) {
      return editErrors[fieldName];
    }

    const fieldValue = fieldName === "displayName" ? editDisplayName : editDocumentDate;
    if (combinedEditErrors[fieldName] && shouldShowEditError(fieldName, fieldValue)) {
      return combinedEditErrors[fieldName];
    }

    return undefined;
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingDocument) {
      return;
    }

    setError(null);
    setSuccess(null);
    setEditErrors({});

    const isValid = validateAllEditFields({
      displayName: editDisplayName,
      documentDate: editDocumentDate,
    });
    if (!isValid) {
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await fetch(`/api/admin/documents/${editingDocument.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: editDisplayName,
          documentDate: editDocumentDate,
        }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };

      if (!response.ok) {
        const message = payload.error || "Dokument konnte nicht aktualisiert werden";
        const fieldErrorMap = mapServerErrorToField(message, DOCUMENT_FIELD_KEYWORDS);

        if (Object.keys(fieldErrorMap).length > 0) {
          setEditErrors(fieldErrorMap);
        } else {
          setEditErrors({ general: message });
        }
        setIsSavingEdit(false);
        return;
      }

      setSuccess("Dokument wurde aktualisiert.");
      closeEditModal();
      await loadDocuments(page, searchQuery);
    } catch (updateError: unknown) {
      setEditErrors({
        general: updateError instanceof Error ? updateError.message : "Dokument konnte nicht aktualisiert werden",
      });
      setIsSavingEdit(false);
    }
  };

  const openViewer = (document: DocumentItem) => {
    setViewerDocument(document);
    setIsViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerDocument(null);
    setIsViewerOpen(false);
  };

  const viewerContent = useMemo(() => {
    if (!viewerDocument) {
      return null;
    }

    const source = `/api/admin/documents/${viewerDocument.id}/view`;

    if (viewerDocument.mimeType === "application/pdf") {
      return (
        <iframe
          src={source}
          title={viewerDocument.displayName}
          className="w-full h-[70vh] border border-gray-200 rounded"
        />
      );
    }

    if (viewerDocument.mimeType.startsWith("image/")) {
      return (
        <iframe
          src={source}
          title={viewerDocument.displayName}
          className="w-full h-[70vh] border border-gray-200 rounded bg-gray-100"
        />
      );
    }

    return <p className="text-gray-600">Dieser Dateityp kann nicht direkt angezeigt werden.</p>;
  }, [viewerDocument]);

  if (status === "loading" || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Dokumente verwalten</h1>
          <p className="text-base text-gray-600 mt-2">Dokumente hochladen, durchsuchen, ansehen und verwalten</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded mb-4" role="status" aria-live="polite">
            {success}
          </div>
        )}

        <section className="card-compact mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Neues Dokument hochladen</h2>
          <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="document-file" className="form-label">Datei</label>
              <input
                id="document-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="form-input"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                disabled={isUploading}
                required
              />
              <p className="form-help">Erlaubte Formate: PDF, JPG, PNG, WEBP. Maximal {maxUploadMb} MB.</p>
            </div>

            <div>
              <label htmlFor="document-display-name" className="form-label">Dokumentenname</label>
              <input
                id="document-display-name"
                type="text"
                className="form-input"
                value={uploadDisplayName}
                onChange={(event) => setUploadDisplayName(event.target.value)}
                placeholder="Optional (sonst Dateiname)"
                disabled={isUploading}
                maxLength={200}
              />
            </div>

            <div>
              <GermanDatePicker
                id="document-date"
                value={uploadDocumentDate || null}
                onChange={(nextDate) => setUploadDocumentDate(nextDate)}
                label="Dokumentdatum"
                disabled={isUploading}
              />
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-base"
                disabled={isUploading}
              >
                {isUploading ? "Wird hochgeladen..." : "Dokument hochladen"}
              </button>
              {isUploading && (
                <div className="w-full sm:w-96">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-brand-red-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Upload-Fortschritt: {uploadProgress}%</p>
                </div>
              )}
            </div>
          </form>
        </section>

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Dokumentenliste</h2>
              <p className="text-base text-gray-600 mt-1">{total} Einträge</p>
            </div>
            <form onSubmit={handleSubmitSearch} className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Suche nach Dokumentenname"
                className="form-input w-full md:w-80"
              />
              <button type="submit" className="btn-primary px-4 py-2 text-base whitespace-nowrap w-full sm:w-auto">
                Suchen
              </button>
            </form>
          </div>

          {showMobileCards && (
          <div className="space-y-3 md:hidden">
            {documents.length === 0 ? (
              <div className="border border-gray-200 rounded-md bg-white px-4 py-8 text-base text-gray-500 text-center">
                Keine Dokumente gefunden.
              </div>
            ) : (
              documents.map((document) => (
                <article key={document.id} className="border border-gray-200 rounded-md bg-white p-4 space-y-2">
                  <p className="font-semibold text-gray-900">
                    Dokument: <SearchHighlight text={document.displayName} query={searchQuery} />
                  </p>
                  <p className="text-sm text-gray-500">{formatFileSize(document.sizeBytes)} · {document.mimeType}</p>
                  <p className="text-base text-gray-700 break-all">
                    <span className="font-semibold text-gray-900">Datei:</span>{" "}
                    <SearchHighlight text={document.originalFileName} query={searchQuery} />
                  </p>
                  <p className="text-base text-gray-700">
                    <span className="font-semibold text-gray-900">Dokumentdatum:</span> {formatDate(document.documentDate)}
                  </p>
                  <p className="text-base text-gray-700">
                    <span className="font-semibold text-gray-900">Hochgeladen am:</span> {formatDateTime(document.createdAt)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      className="btn-outline px-3 py-2 text-sm"
                      onClick={() => openViewer(document)}
                      disabled={!isViewableDocument(document)}
                    >
                      Ansehen
                    </button>
                    <a
                      className="btn-outline px-3 py-2 text-sm text-center"
                      href={`/api/admin/documents/${document.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      className="btn-outline px-3 py-2 text-sm"
                      onClick={() => openEditModal(document)}
                    >
                      Umbenennen
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                      onClick={() => handleDelete(document)}
                      disabled={deletingId === document.id}
                    >
                      {deletingId === document.id ? "Wird gelöscht..." : "Löschen"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          )}

          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-md bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-base font-semibold text-gray-700">Dokumentenname</th>
                  <th className="px-4 py-3 text-left text-base font-semibold text-gray-700">Datei</th>
                  <th className="px-4 py-3 text-left text-base font-semibold text-gray-700">Dokumentdatum</th>
                  <th className="px-4 py-3 text-left text-base font-semibold text-gray-700">Hochgeladen am</th>
                  <th className="px-4 py-3 text-left text-base font-semibold text-gray-700">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-base text-gray-500 text-center" colSpan={5}>
                      Keine Dokumente gefunden.
                    </td>
                  </tr>
                ) : (
                  documents.map((document) => (
                    <tr key={document.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-base text-gray-900">
                        <p className="font-semibold">
                          <SearchHighlight text={document.displayName} query={searchQuery} />
                        </p>
                        <p className="text-sm text-gray-500">{formatFileSize(document.sizeBytes)} · {document.mimeType}</p>
                      </td>
                      <td className="px-4 py-3 text-base text-gray-700">
                        <SearchHighlight text={document.originalFileName} query={searchQuery} />
                      </td>
                      <td className="px-4 py-3 text-base text-gray-700">{formatDate(document.documentDate)}</td>
                      <td className="px-4 py-3 text-base text-gray-700">{formatDateTime(document.createdAt)}</td>
                      <td className="px-4 py-3 text-base text-gray-900">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-outline px-3 py-2 text-sm"
                            onClick={() => openViewer(document)}
                            disabled={!isViewableDocument(document)}
                          >
                            Ansehen
                          </button>
                          <a
                            className="btn-outline px-3 py-2 text-sm"
                            href={`/api/admin/documents/${document.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            className="btn-outline px-3 py-2 text-sm"
                            onClick={() => openEditModal(document)}
                          >
                            Umbenennen
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                            onClick={() => handleDelete(document)}
                            disabled={deletingId === document.id}
                          >
                            {deletingId === document.id ? "Wird gelöscht..." : "Löschen"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={isLoading} />
        </section>
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Dokument bearbeiten"
        size="lg"
        contentOverflow="visible"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4" noValidate>
          {editErrors.general && Object.keys(inferredEditGeneralErrors).length === 0 && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {editErrors.general}
            </div>
          )}
          <ValidatedFieldGroup
            id="edit-display-name"
            label="Dokumentenname"
            name="displayName"
            type="text"
            value={editDisplayName}
            onChange={(event) => handleEditFieldChange("displayName", event.target.value)}
            onBlur={(event) => handleEditFieldBlur("displayName", event.target.value)}
            required
            maxLength={200}
            autoFocus
            disabled={isSavingEdit}
            error={getEditFieldError("displayName")}
            showSuccess={isEditValidAndTouched("displayName", editDisplayName)}
          />

          <GermanDatePicker
            id="edit-document-date"
            value={editDocumentDate || null}
            onChange={(nextDate) => handleEditFieldChange("documentDate", nextDate)}
            onBlur={() => handleEditFieldBlur("documentDate", editDocumentDate)}
            label="Dokumentdatum"
            error={getEditFieldError("documentDate")}
            showSuccess={isEditValidAndTouched("documentDate", editDocumentDate)}
            disabled={isSavingEdit}
          />

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline px-4 py-2 text-base" onClick={closeEditModal} disabled={isSavingEdit}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary px-4 py-2 text-base" disabled={isSavingEdit}>
              {isSavingEdit ? "Wird gespeichert..." : "Speichern"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isViewerOpen}
        onClose={closeViewer}
        title={viewerDocument ? `Vorschau: ${viewerDocument.displayName}` : "Vorschau"}
        size="4xl"
      >
        {viewerContent}
      </Modal>
    </main>
  );
}

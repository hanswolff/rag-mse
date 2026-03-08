"use client";

import { FormEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackLink } from "@/components/back-link";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { SearchHighlight } from "@/components/search-highlight";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { ArrowUpIcon, PencilIcon, TrashIcon, DownloadIcon, EyeIcon, EyeOffIcon, FolderIcon, FileIcon } from "@/components/icons";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { canAccessAdminArea, isAdmin } from "@/lib/role-utils";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToField, DOCUMENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { documentValidationConfig } from "@/lib/validation-schema";
import { pluralize } from "@/lib/pluralization";
import type { DocumentDirectoryItem, DocumentItem } from "@/types";

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

type DocumentDirectoriesResponse = {
  rootCount: number;
  directories: DocumentDirectoryItem[];
};

type DirectoryFilter = "root" | string;
type DocumentSortField = "displayName" | "documentDate" | "updatedAt" | "mimeType" | "sizeBytes";
type DocumentSortDirection = "asc" | "desc";

const PAGE_SIZE = 20;
const DOCUMENT_UPLOAD_ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  ".docx",
  ".xlsx",
  ".odt",
  ".ods",
].join(",");
const DOCUMENT_UPLOAD_FORMATS_LABEL = "PDF, JPG, JPEG, PNG, WEBP, DOCX, XLSX, ODT, ODS";

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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
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

function IconButton({
  label,
  onClick,
  className,
  children,
  disabled,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 ${className || ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function AdminDocumentsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canManage = session ? isAdmin(session.user) : false;

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState<DocumentSortField>("documentDate");
  const [sortDir, setSortDir] = useState<DocumentSortDirection>("desc");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [directories, setDirectories] = useState<DocumentDirectoryItem[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryFilter>("root");
  const [rootCount, setRootCount] = useState(0);
  const [newDirectoryName, setNewDirectoryName] = useState("");
  const [isSavingDirectory, setIsSavingDirectory] = useState(false);
  const [renamingDirectoryId, setRenamingDirectoryId] = useState<string | null>(null);
  const [renamingDirectoryName, setRenamingDirectoryName] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadDocumentDate, setUploadDocumentDate] = useState("");
  const [uploadDirectoryId, setUploadDirectoryId] = useState<DirectoryFilter>("root");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [maxUploadMb, setMaxUploadMb] = useState(15);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDocumentDate, setEditDocumentDate] = useState("");
  const [editDirectoryId, setEditDirectoryId] = useState<DirectoryFilter>("root");
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
  const inferredEditGeneralErrors = useMemo(() => {
    return mapServerErrorToField(editErrors.general || "", DOCUMENT_FIELD_KEYWORDS);
  }, [editErrors.general]);

  const combinedEditErrors = useMemo(() => {
    return { ...editValidationErrors, ...inferredEditGeneralErrors, ...editErrors };
  }, [editValidationErrors, inferredEditGeneralErrors, editErrors]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !canAccessAdminArea(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  const loadDirectories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/document-directories");
      const data = (await response.json()) as DocumentDirectoriesResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Verzeichnisse konnten nicht geladen werden");
      }

      const payload = data as DocumentDirectoriesResponse;
      setDirectories(payload.directories);
      setRootCount(payload.rootCount);
    } catch (directoryLoadError: unknown) {
      setDirectories([]);
      setRootCount(0);
      setError(directoryLoadError instanceof Error ? directoryLoadError.message : "Verzeichnisse konnten nicht geladen werden");
    }
  }, []);

  const loadDocuments = useCallback(
    async (
      targetPage: number,
      query: string,
      directory: DirectoryFilter,
      nextSortBy: DocumentSortField,
      nextSortDir: DocumentSortDirection,
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
          sortBy: nextSortBy,
          sortDir: nextSortDir,
        });

        if (query.trim().length > 0) {
          params.set("q", query.trim());
        }

        params.set("directory", directory);

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
    },
    [],
  );

  useEffect(() => {
    if (status !== "authenticated" || !session || !canAccessAdminArea(session.user)) {
      return;
    }

    void loadDirectories();
    void loadDocuments(page, searchQuery, selectedDirectory, sortBy, sortDir);
  }, [status, session, page, searchQuery, selectedDirectory, sortBy, sortDir, loadDirectories, loadDocuments]);

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
      formData.append("directoryId", uploadDirectoryId === "root" ? "" : uploadDirectoryId);

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
          setUploadDirectoryId(selectedDirectory);

          const fileInput = document.getElementById("document-file") as HTMLInputElement | null;
          if (fileInput) {
            fileInput.value = "";
          }

          setPage(1);
          await Promise.all([
            loadDocuments(1, searchQuery, selectedDirectory, sortBy, sortDir),
            loadDirectories(),
          ]);
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
      await Promise.all([
        loadDocuments(page, searchQuery, selectedDirectory, sortBy, sortDir),
        loadDirectories(),
      ]);
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
    setEditDirectoryId(document.directoryId || "root");
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
    setEditDirectoryId("root");
    setEditErrors({});
    resetEditValidation();
    setIsSavingEdit(false);
  };

  const handleEditFieldChange = (name: "displayName" | "documentDate" | "directoryId", value: string) => {
    if (name === "displayName") {
      setEditDisplayName(value);
    } else if (name === "documentDate") {
      setEditDocumentDate(value);
    } else {
      setEditDirectoryId(value as DirectoryFilter);
    }

    setEditErrors((prev) => ({ ...prev, [name]: "", general: "" }));

    if (editValidationErrors[name]) {
      validateEditField(name, value);
    }
  };

  const handleEditFieldBlur = (name: "displayName" | "documentDate" | "directoryId", value: string) => {
    markEditFieldAsTouched(name);
    validateEditField(name, value);
  };

  const getEditFieldError = (fieldName: "displayName" | "documentDate" | "directoryId"): string | undefined => {
    if (editErrors[fieldName]) {
      return editErrors[fieldName];
    }

    const fieldValue = fieldName === "displayName" ? editDisplayName : fieldName === "documentDate" ? editDocumentDate : editDirectoryId;
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
      directoryId: editDirectoryId,
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
          directoryId: editDirectoryId === "root" ? null : editDirectoryId,
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
      await Promise.all([
        loadDocuments(page, searchQuery, selectedDirectory, sortBy, sortDir),
        loadDirectories(),
      ]);
    } catch (updateError: unknown) {
      setEditErrors({
        general: updateError instanceof Error ? updateError.message : "Dokument konnte nicht aktualisiert werden",
      });
      setIsSavingEdit(false);
    }
  };

  const handleCreateDirectory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      const response = await fetch("/api/admin/document-directories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newDirectoryName }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Verzeichnis konnte nicht erstellt werden");
      }

      setNewDirectoryName("");
      setSuccess("Verzeichnis wurde erstellt.");
      await loadDirectories();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Verzeichnis konnte nicht erstellt werden");
    } finally {
      setIsSavingDirectory(false);
    }
  };

  const handleStartRenameDirectory = (directory: DocumentDirectoryItem) => {
    setRenamingDirectoryId(directory.id);
    setRenamingDirectoryName(directory.name);
    setError(null);
    setSuccess(null);
  };

  const handleSaveRenameDirectory = async () => {
    if (!renamingDirectoryId) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      const response = await fetch(`/api/admin/document-directories/${renamingDirectoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: renamingDirectoryName }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Verzeichnis konnte nicht umbenannt werden");
      }

      setSuccess("Verzeichnis wurde umbenannt.");
      setRenamingDirectoryId(null);
      setRenamingDirectoryName("");
      await Promise.all([
        loadDirectories(),
        loadDocuments(page, searchQuery, selectedDirectory, sortBy, sortDir),
      ]);
    } catch (renameError: unknown) {
      setError(renameError instanceof Error ? renameError.message : "Verzeichnis konnte nicht umbenannt werden");
    } finally {
      setIsSavingDirectory(false);
    }
  };

  const handleDeleteDirectory = async (directory: DocumentDirectoryItem) => {
    if (!confirm(`Soll das Verzeichnis \"${directory.name}\" wirklich gelöscht werden?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      const response = await fetch(`/api/admin/document-directories/${directory.id}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Verzeichnis konnte nicht gelöscht werden");
      }

      if (selectedDirectory === directory.id) {
        setSelectedDirectory("root");
        setUploadDirectoryId("root");
      }
      setSuccess("Verzeichnis wurde gelöscht.");
      await Promise.all([
        loadDirectories(),
        loadDocuments(1, searchQuery, selectedDirectory === directory.id ? "root" : selectedDirectory, sortBy, sortDir),
      ]);
      if (selectedDirectory === directory.id) {
        setPage(1);
      }
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Verzeichnis konnte nicht gelöscht werden");
    } finally {
      setIsSavingDirectory(false);
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

  const currentDirectory = useMemo(
    () => (selectedDirectory === "root" ? null : directories.find((directory) => directory.id === selectedDirectory) || null),
    [directories, selectedDirectory],
  );

  const navigateToRoot = () => {
    setSelectedDirectory("root");
    setUploadDirectoryId("root");
    setPage(1);
  };

  const navigateToDirectory = (directoryId: string) => {
    setSelectedDirectory(directoryId);
    setUploadDirectoryId(directoryId);
    setPage(1);
  };

  const handleSortChange = (field: DocumentSortField) => {
    setPage(1);
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDir(field === "updatedAt" || field === "documentDate" ? "desc" : "asc");
  };

  const getSortIndicator = (field: DocumentSortField) => {
    if (sortBy !== field) {
      return "↕";
    }
    return sortDir === "asc" ? "↑" : "↓";
  };

  const openDocumentFromList = (document: DocumentItem) => {
    openViewer(document);
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

        {canManage && (
          <section className="card-compact mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Neues Dokument hochladen</h2>
            <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="document-file" className="form-label">Datei</label>
              <input
                id="document-file"
                type="file"
                accept={DOCUMENT_UPLOAD_ACCEPT}
                className="form-input"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                disabled={isUploading}
                required
              />
              <p className="form-help">Erlaubte Formate: {DOCUMENT_UPLOAD_FORMATS_LABEL}. Maximal {maxUploadMb} MB.</p>
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
              <label htmlFor="document-directory" className="form-label">Verzeichnis</label>
              <select
                id="document-directory"
                className="form-input"
                value={uploadDirectoryId}
                onChange={(event) => setUploadDirectoryId(event.target.value)}
                disabled={isUploading}
              >
                <option value="root">/</option>
                {directories.map((directory) => (
                  <option key={directory.id} value={directory.id}>
                    {directory.name}
                  </option>
                ))}
              </select>
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
        )}

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Dokumente</h2>
              <p className="text-base text-gray-600 mt-1">{total} {pluralize(total, "Datei", "Dateien")}</p>
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

          {canManage && selectedDirectory === "root" && (
            <form onSubmit={handleCreateDirectory} className="mb-3 flex w-full md:w-auto gap-2">
              <input
                type="text"
                className="form-input w-full md:w-72"
                placeholder="Neues Verzeichnis"
                value={newDirectoryName}
                onChange={(event) => setNewDirectoryName(event.target.value)}
                maxLength={120}
                disabled={isSavingDirectory}
              />
              <button type="submit" className="btn-primary px-4 py-2 text-base whitespace-nowrap" disabled={isSavingDirectory}>
                Verzeichnis erstellen
              </button>
            </form>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm border border-gray-200 rounded-md bg-gray-50 px-3 py-2">
            <button type="button" className="link-primary font-medium" onClick={navigateToRoot}>
              /
            </button>
            {currentDirectory && (
              <>
                <span className="text-gray-400">›</span>
                <span className="text-gray-700 font-medium">{currentDirectory.name}</span>
                <button
                  type="button"
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  onClick={navigateToRoot}
                  aria-label="Zum übergeordneten Verzeichnis"
                  title="Zum übergeordneten Verzeichnis"
                >
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <span className="ml-auto text-gray-500">
              {selectedDirectory === "root"
                ? `${directories.length} ${pluralize(directories.length, "Verzeichnis", "Verzeichnisse")}, ${rootCount} ${pluralize(rootCount, "Datei", "Dateien")}`
                : `${total} ${pluralize(total, "Datei", "Dateien")}`}
            </span>
          </div>

          {renamingDirectoryId && canManage && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveRenameDirectory();
              }}
              className="mb-3 border border-gray-200 rounded-md bg-white p-3 flex flex-col sm:flex-row gap-2 sm:items-center"
            >
              <label htmlFor="rename-directory-input" className="text-sm font-medium text-gray-700 whitespace-nowrap">Verzeichnis umbenennen</label>
              <input
                id="rename-directory-input"
                type="text"
                className="form-input sm:w-80"
                value={renamingDirectoryName}
                onChange={(event) => setRenamingDirectoryName(event.target.value)}
                maxLength={120}
                disabled={isSavingDirectory}
              />
              <button type="submit" className="btn-primary px-3 py-2 text-sm" disabled={isSavingDirectory}>
                Speichern
              </button>
              <button
                type="button"
                className="btn-outline px-3 py-2 text-sm"
                onClick={() => {
                  setRenamingDirectoryId(null);
                  setRenamingDirectoryName("");
                }}
                disabled={isSavingDirectory}
              >
                Abbrechen
              </button>
            </form>
          )}

          <div className="overflow-x-auto border border-gray-200 rounded-md bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => handleSortChange("displayName")}>
                      Name
                      <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("displayName")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => handleSortChange("documentDate")}>
                      Dokumentdatum
                      <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("documentDate")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => handleSortChange("updatedAt")}>
                      Geändert am
                      <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("updatedAt")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => handleSortChange("mimeType")}>
                      Typ
                      <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("mimeType")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900" onClick={() => handleSortChange("sizeBytes")}>
                      Größe
                      <span className="text-xs text-gray-500" aria-hidden="true">{getSortIndicator("sizeBytes")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {selectedDirectory === "root" && directories.map((directory) => (
                  <tr
                    key={directory.id}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    tabIndex={0}
                    onClick={() => navigateToDirectory(directory.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToDirectory(directory.id);
                      }
                    }}
                  >
                    <td className="px-3 py-2 text-sm text-gray-900">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <FolderIcon className="w-5 h-5 text-amber-600" />
                        <SearchHighlight text={directory.name} query={searchQuery} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">-</td>
                    <td className="px-3 py-2 text-sm text-gray-600">-</td>
                    <td className="px-3 py-2 text-sm text-gray-600">Dateiordner</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600">{directory.documentCount}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <div className="inline-flex items-center gap-1">
                          <IconButton
                            label="Verzeichnis umbenennen"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStartRenameDirectory(directory);
                            }}
                          >
                            <PencilIcon className="w-4 h-4 text-gray-700" />
                          </IconButton>
                          <IconButton
                            label="Verzeichnis löschen"
                            className="text-red-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteDirectory(directory);
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-700" />
                          </IconButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {documents.length === 0 && selectedDirectory !== "root" ? (
                  <tr>
                    <td className="px-3 py-8 text-base text-gray-500 text-center" colSpan={6}>
                      Keine Dokumente gefunden.
                    </td>
                  </tr>
                ) : (
                  documents.map((document) => {
                    const isViewable = isViewableDocument(document);
                    const downloadUrl = `/api/admin/documents/${document.id}/download`;
                    return (
                    <tr
                      key={document.id}
                      className={`border-t border-gray-100 ${isViewable ? "hover:bg-gray-50 cursor-pointer" : ""}`}
                      tabIndex={isViewable ? 0 : -1}
                      aria-disabled={isViewable ? undefined : true}
                      onClick={isViewable ? () => openDocumentFromList(document) : undefined}
                      onKeyDown={isViewable
                        ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDocumentFromList(document);
                          }
                        }
                        : undefined}
                    >
                      <td className="px-3 py-2 text-sm text-gray-900">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <FileIcon className="w-5 h-5 text-gray-500" />
                          <SearchHighlight text={document.displayName} query={searchQuery} />
                        </span>
                        <p className="text-xs text-gray-500 ml-7">
                          <SearchHighlight text={document.originalFileName} query={searchQuery} />
                        </p>
                        {!isViewable && (
                          <span className="inline-flex ml-7 mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Nur Download
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">{formatDate(document.documentDate)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{formatDateTime(document.updatedAt)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{document.mimeType}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 text-right">{formatFileSize(document.sizeBytes)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <a
                            className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50"
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Download"
                            title="Download"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DownloadIcon className="w-4 h-4 text-gray-700" />
                          </a>
                          {isViewable ? (
                            <IconButton
                              label="Vorschau"
                              onClick={(event) => {
                                event.stopPropagation();
                                openViewer(document);
                              }}
                            >
                              <EyeIcon className="w-4 h-4 text-gray-700" />
                            </IconButton>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                              aria-label="Vorschau nicht verfügbar"
                              title="Vorschau nicht verfügbar"
                              disabled
                              onClick={(event) => event.stopPropagation()}
                            >
                              <EyeOffIcon className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            <>
                              <IconButton
                                label="Bearbeiten"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(document);
                                }}
                              >
                                <PencilIcon className="w-4 h-4 text-gray-700" />
                              </IconButton>
                              <IconButton
                                label="Löschen"
                                className="text-red-700"
                                disabled={deletingId === document.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDelete(document);
                                }}
                              >
                                <TrashIcon className="w-4 h-4 text-red-700" />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
                {selectedDirectory === "root" && directories.length === 0 && documents.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-base text-gray-500 text-center" colSpan={6}>
                      Keine Verzeichnisse oder Dokumente gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={isLoading} />
        </section>
      </div>

      {canManage && (
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

            <div>
              <label htmlFor="edit-document-directory" className="form-label">Verzeichnis</label>
              <select
                id="edit-document-directory"
                className="form-input"
                value={editDirectoryId}
                onChange={(event) => handleEditFieldChange("directoryId", event.target.value)}
                onBlur={(event) => handleEditFieldBlur("directoryId", event.target.value)}
                disabled={isSavingEdit}
              >
                <option value="root">/</option>
                {directories.map((directory) => (
                  <option key={directory.id} value={directory.id}>
                    {directory.name}
                  </option>
                ))}
              </select>
              {getEditFieldError("directoryId") && (
                <p className="text-sm text-red-700 mt-1">{getEditFieldError("directoryId")}</p>
              )}
            </div>

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
      )}

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

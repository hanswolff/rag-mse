"use client";

import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackLink } from "@/components/back-link";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { DocumentBreadcrumb } from "@/components/document-breadcrumb";
import { DocumentTableHeader, DirectoryRow, DocumentRow, EmptyRow, IconButton } from "@/components/document-table";
import { DocumentViewer } from "@/components/document-viewer";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { canAccessAdminArea, isAdmin } from "@/lib/role-utils";
import { useDocumentsList } from "@/lib/use-documents-list";
import { useFormFieldValidation } from "@/lib/useFormFieldValidation";
import { mapServerErrorToField, DOCUMENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import { documentValidationConfig } from "@/lib/validation-schema";
import { pluralize } from "@/lib/pluralization";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMATS_LABEL,
  formatDateForInput,
  type DirectoryFilter,
} from "@/lib/document-utils";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

export type DocumentAreaType = "ADMIN" | "MEMBER";

type AdminDocumentManagerProps = {
  area: DocumentAreaType;
  title: string;
  listTitle: string;
  description: string;
  backLabel?: string;
};

export function AdminDocumentManager({ area, title, listTitle, description, backLabel = "Zurück zum Dashboard" }: AdminDocumentManagerProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scopedQueryParams = useMemo(() => ({ area }), [area]);

  const {
    status,
    currentUser,
    documents,
    isLoading,
    error,
    total,
    page,
    totalPages,
    searchInput,
    searchQuery,
    directories,
    selectedDirectory,
    rootCount,
    maxUploadMb,
    sortBy,
    sortDir,
    setSearchInput,
    handleSubmitSearch,
    clearSearch,
    setSelectedDirectory,
    setPage,
    navigateToRoot,
    navigateToDirectory,
    handleSortChange,
    reload,
    reloadDirectories,
  } = useDocumentsList({
    documentsApiPrefix: "/api/admin/documents",
    directoriesApiPrefix: "/api/admin/document-directories",
    accessCheck: canAccessAdminArea,
    documentsQueryParams: scopedQueryParams,
    directoriesQueryParams: scopedQueryParams,
  });
  const canManage = currentUser ? isAdmin(currentUser) : false;

  // Directory management state
  const [newDirectoryName, setNewDirectoryName] = useState("");
  const [isSavingDirectory, setIsSavingDirectory] = useState(false);
  const [renamingDirectoryId, setRenamingDirectoryId] = useState<string | null>(null);
  const [renamingDirectoryName, setRenamingDirectoryName] = useState("");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadDocumentDate, setUploadDocumentDate] = useState("");
  const [uploadDirectoryId, setUploadDirectoryId] = useState<DirectoryFilter>("root");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingDocumentId, setDraggingDocumentId] = useState<string | null>(null);
  const [dropTargetDirectoryId, setDropTargetDirectoryId] = useState<string | null>(null);
  const [isMovingDocument, setIsMovingDocument] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDocumentDate, setEditDocumentDate] = useState("");
  const [editDirectoryId, setEditDirectoryId] = useState<DirectoryFilter>("root");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Viewer state
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
    setUploadDirectoryId(selectedDirectory);
  }, [selectedDirectory]);

  const isSearchActive = searchQuery.trim().length > 0;
  const visibleError = actionError || error;

  const acceptedUploadTypes = useMemo(
    () => new Set(
      DOCUMENT_UPLOAD_ACCEPT
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0)
    ),
    []
  );

  const validateUploadFile = useCallback((file: File): string | null => {
    const maxBytes = maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Datei ist zu groß. Maximal ${maxUploadMb} MB erlaubt.`;
    }

    const fileType = file.type.trim().toLowerCase();
    const fileExtension = file.name.includes(".")
      ? `.${file.name.split(".").pop()?.toLowerCase() || ""}`
      : "";

    const isAcceptedType = acceptedUploadTypes.has(fileType);
    const isAcceptedExtension = fileExtension.length > 1 && acceptedUploadTypes.has(fileExtension);

    if (!isAcceptedType && !isAcceptedExtension) {
      return `Dateiformat nicht erlaubt. Erlaubte Formate: ${DOCUMENT_UPLOAD_FORMATS_LABEL}.`;
    }

    return null;
  }, [acceptedUploadTypes, maxUploadMb]);

  const resetUploadFileInput = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const setUploadFile = useCallback((file: File | null) => {
    if (!file) {
      resetUploadFileInput();
      return;
    }

    const fileError = validateUploadFile(file);
    if (fileError) {
      setActionError(fileError);
      setSuccess(null);
      resetUploadFileInput();
      return;
    }

    setActionError(null);
    setSuccess(null);
    setSelectedFile(file);
  }, [resetUploadFileInput, validateUploadFile]);

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUploadFile(event.target.files?.[0] || null);
  };

  const handleDropZoneDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDropZoneDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    event.dataTransfer.dropEffect = "copy";
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDropZoneDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDropZoneDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setUploadFile(event.dataTransfer.files?.[0] || null);
  };

  const handleDropZoneKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);

    if (!selectedFile) {
      setActionError("Bitte wählen Sie eine Datei aus.");
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
      formData.append("area", area);

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) return;
        const nextProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setUploadProgress(nextProgress);
      };

      xhr.onreadystatechange = async () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;

        try {
          const payload = xhr.responseText ? JSON.parse(xhr.responseText) as { error?: string } : {};
          if (xhr.status < 200 || xhr.status >= 300) {
            throw new Error(payload.error || "Upload fehlgeschlagen");
          }

          setSuccess("Dokument wurde erfolgreich hochgeladen.");
          resetUploadFileInput();
          setUploadDisplayName("");
          setUploadDocumentDate("");
          setPage(1);
          await Promise.all([
            reloadDirectories(),
            reload(),
          ]);
        } catch (uploadError: unknown) {
          setActionError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen");
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
    setActionError(null);
    setSuccess(null);

    if (!confirm(`Soll das Dokument "${document.displayName}" wirklich gelöscht werden?`)) return;

    setDeletingId(document.id);

    try {
      const response = await fetch(`/api/admin/documents/${document.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Dokument konnte nicht gelöscht werden");
      }

      setSuccess("Dokument wurde gelöscht.");
      await reload();
    } catch (deleteError: unknown) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Dokument konnte nicht gelöscht werden");
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
    setActionError(null);
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
    if (editErrors[fieldName]) return editErrors[fieldName];
    const fieldValue = fieldName === "displayName" ? editDisplayName : fieldName === "documentDate" ? editDocumentDate : editDirectoryId;
    if (combinedEditErrors[fieldName] && shouldShowEditError(fieldName, fieldValue)) {
      return combinedEditErrors[fieldName];
    }
    return undefined;
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDocument) return;

    setActionError(null);
    setSuccess(null);
    setEditErrors({});

    const isValid = validateAllEditFields({
      displayName: editDisplayName,
      documentDate: editDocumentDate,
      directoryId: editDirectoryId,
    });
    if (!isValid) return;

    setIsSavingEdit(true);

    try {
      const response = await fetch(`/api/admin/documents/${editingDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      await reload();
    } catch (updateError: unknown) {
      setEditErrors({
        general: updateError instanceof Error ? updateError.message : "Dokument konnte nicht aktualisiert werden",
      });
      setIsSavingEdit(false);
    }
  };

  // Directory management handlers
  const handleCreateDirectory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      const response = await fetch("/api/admin/document-directories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDirectoryName, area }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Verzeichnis konnte nicht erstellt werden");
      }

      setNewDirectoryName("");
      setSuccess("Verzeichnis wurde erstellt.");
      await reload();
    } catch (createError: unknown) {
      setActionError(createError instanceof Error ? createError.message : "Verzeichnis konnte nicht erstellt werden");
    } finally {
      setIsSavingDirectory(false);
    }
  };

  const handleStartRenameDirectory = (directory: DocumentDirectoryItem) => {
    setRenamingDirectoryId(directory.id);
    setRenamingDirectoryName(directory.name);
    setActionError(null);
    setSuccess(null);
  };

  const handleSaveRenameDirectory = async () => {
    if (!renamingDirectoryId) return;

    setActionError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      const response = await fetch(`/api/admin/document-directories/${renamingDirectoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renamingDirectoryName }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Verzeichnis konnte nicht umbenannt werden");
      }

      setSuccess("Verzeichnis wurde umbenannt.");
      setRenamingDirectoryId(null);
      setRenamingDirectoryName("");
      await reload();
    } catch (renameError: unknown) {
      setActionError(renameError instanceof Error ? renameError.message : "Verzeichnis konnte nicht umbenannt werden");
    } finally {
      setIsSavingDirectory(false);
    }
  };

  const handleDeleteDirectory = async (directory: DocumentDirectoryItem) => {
    if (!confirm(`Soll das Verzeichnis "${directory.name}" wirklich gelöscht werden?`)) return;

    setActionError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      const response = await fetch(`/api/admin/document-directories/${directory.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Verzeichnis konnte nicht gelöscht werden");
      }

      if (selectedDirectory === directory.id) {
        setSelectedDirectory("root");
        setUploadDirectoryId("root");
      }
      setSuccess("Verzeichnis wurde gelöscht.");
      await reload();
      if (selectedDirectory === directory.id) {
        setPage(1);
      }
    } catch (deleteError: unknown) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Verzeichnis konnte nicht gelöscht werden");
    } finally {
      setIsSavingDirectory(false);
    }
  };

  // Navigation handlers
  const openViewer = (document: DocumentItem) => {
    setViewerDocument(document);
    setIsViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerDocument(null);
    setIsViewerOpen(false);
  };

  const moveDocumentToDirectory = async (document: DocumentItem, targetDirectoryId: string) => {
    setActionError(null);
    setSuccess(null);
    setIsMovingDocument(true);

    try {
      const response = await fetch(`/api/admin/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryId: targetDirectoryId }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Dokument konnte nicht verschoben werden");
      }

      const directory = directories.find((item) => item.id === targetDirectoryId);
      const targetName = directory?.name || "Verzeichnis";
      setSuccess(`Dokument wurde nach "${targetName}" verschoben.`);
      await reload();
    } catch (moveError: unknown) {
      setActionError(moveError instanceof Error ? moveError.message : "Dokument konnte nicht verschoben werden");
    } finally {
      setIsMovingDocument(false);
    }
  };

  const handleDocumentDragStart = (event: DragEvent<HTMLTableRowElement>, document: DocumentItem) => {
    if (!canManage || selectedDirectory !== "root" || isSearchActive || isMovingDocument) {
      event.preventDefault();
      return;
    }
    setDraggingDocumentId(document.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", document.id);
    }
  };

  const handleDocumentDragEnd = () => {
    setDraggingDocumentId(null);
    setDropTargetDirectoryId(null);
  };

  const handleDirectoryDragOver = (event: DragEvent<HTMLTableRowElement>, directoryId: string) => {
    if (!draggingDocumentId || isMovingDocument) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    if (dropTargetDirectoryId !== directoryId) {
      setDropTargetDirectoryId(directoryId);
    }
  };

  const handleDirectoryDragLeave = (event: DragEvent<HTMLTableRowElement>, directoryId: string) => {
    if (dropTargetDirectoryId !== directoryId) {
      return;
    }
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setDropTargetDirectoryId(null);
  };

  const handleDirectoryDrop = async (event: DragEvent<HTMLTableRowElement>, directoryId: string) => {
    if (!draggingDocumentId || isMovingDocument) {
      return;
    }
    event.preventDefault();
    setDropTargetDirectoryId(null);
    const document = documents.find((item) => item.id === draggingDocumentId);
    if (!document || document.directoryId === directoryId) {
      setDraggingDocumentId(null);
      return;
    }
    await moveDocumentToDirectory(document, directoryId);
    setDraggingDocumentId(null);
  };

  const directoryActions = (directory: DocumentDirectoryItem) => canManage ? (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
  ) : undefined;

  const documentActions = (document: DocumentItem) => canManage ? (
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
  ) : undefined;

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
            {backLabel}
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">{title}</h1>
          <p className="text-base text-gray-600 mt-2">{description}</p>
        </div>

        {visibleError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert" aria-live="assertive">
            {visibleError}
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
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] gap-4">
                <div>
                  <label htmlFor="document-file" className="form-label">Datei</label>
                  <label
                    htmlFor="document-file"
                    className={`upload-dropzone ${isDragActive ? "upload-dropzone-active" : ""} ${isUploading ? "upload-dropzone-disabled" : ""}`}
                    role="button"
                    tabIndex={isUploading ? -1 : 0}
                    aria-disabled={isUploading}
                    aria-describedby="document-upload-help"
                    onDragEnter={handleDropZoneDragEnter}
                    onDragOver={handleDropZoneDragOver}
                    onDragLeave={handleDropZoneDragLeave}
                    onDrop={handleDropZoneDrop}
                    onKeyDown={handleDropZoneKeyDown}
                  >
                    <span className="upload-dropzone-title">
                      {selectedFile ? selectedFile.name : "Datei hierhin ziehen oder anklicken"}
                    </span>
                    <span className="upload-dropzone-subtitle">
                      {selectedFile
                        ? `${Math.max(selectedFile.size / (1024 * 1024), 0.01).toFixed(2)} MB`
                        : "Drag & Drop wird unterstützt"}
                    </span>
                  </label>
                  <input
                    id="document-file"
                    ref={fileInputRef}
                    type="file"
                    accept={DOCUMENT_UPLOAD_ACCEPT}
                    className="sr-only"
                    onChange={handleFileInputChange}
                    disabled={isUploading}
                  />
                  <p id="document-upload-help" className="form-help">Erlaubte Formate: {DOCUMENT_UPLOAD_FORMATS_LABEL}. Maximal {maxUploadMb} MB.</p>
                </div>

                <div className="space-y-4">
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
                    <button type="submit" className="w-full btn-primary px-4 py-2 text-base" disabled={isUploading}>
                      {isUploading ? "Wird hochgeladen..." : "Dokument hochladen"}
                    </button>
                    {isUploading && (
                      <div className="w-full mt-3">
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
                </div>
              </div>

              <details className="rounded-md border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <summary className="cursor-pointer select-none text-sm font-medium text-gray-700">
                  Erweitert (optional)
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <GermanDatePicker
                    id="document-date"
                    value={uploadDocumentDate || null}
                    onChange={(nextDate) => setUploadDocumentDate(nextDate)}
                    label="Dokumentdatum"
                    disabled={isUploading}
                  />
                </div>
              </details>
            </form>
          </section>
        )}

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{listTitle}</h2>
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

          {isSearchActive && (
            <div className="mb-4 flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-blue-900">
                Suche aktiv: <span className="font-semibold">&quot;{searchQuery}&quot;</span>
              </p>
              <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={clearSearch}>
                Suche zurücksetzen
              </button>
            </div>
          )}

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

          <DocumentBreadcrumb
            directories={directories}
            selectedDirectory={selectedDirectory}
            rootCount={rootCount}
            currentCount={total}
            onNavigateRoot={navigateToRoot}
            showUpButton={selectedDirectory !== "root"}
          />

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
              <DocumentTableHeader sortBy={sortBy} sortDir={sortDir} onSortChange={handleSortChange} />
              <tbody>
                {selectedDirectory === "root" && !isSearchActive && directories.map((directory) => (
                  <DirectoryRow
                    key={directory.id}
                    directory={directory}
                    searchQuery={searchQuery}
                    onNavigate={navigateToDirectory}
                    actions={directoryActions(directory)}
                    isDropTarget={dropTargetDirectoryId === directory.id}
                    onDragOver={(event) => handleDirectoryDragOver(event, directory.id)}
                    onDragLeave={(event) => handleDirectoryDragLeave(event, directory.id)}
                    onDrop={(event) => {
                      void handleDirectoryDrop(event, directory.id);
                    }}
                  />
                ))}

                {documents.length > 0 ? (
                  documents.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      searchQuery={searchQuery}
                      downloadUrlPrefix="/api/admin/documents"
                      onOpen={openViewer}
                      actions={documentActions(document)}
                      draggable={canManage && selectedDirectory === "root" && !isSearchActive && !isMovingDocument}
                      onDragStart={(event) => handleDocumentDragStart(event, document)}
                      onDragEnd={handleDocumentDragEnd}
                    />
                  ))
                ) : isSearchActive ? (
                  <EmptyRow colSpan={6} message={`Keine Suchergebnisse für "${searchQuery}" gefunden.`} />
                ) : selectedDirectory !== "root" ? (
                  <EmptyRow colSpan={6} message="Keine Dokumente gefunden." />
                ) : selectedDirectory === "root" && directories.length === 0 ? (
                  <EmptyRow colSpan={6} message="Keine Verzeichnisse oder Dokumente gefunden." />
                ) : null}
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

      <DocumentViewer
        isOpen={isViewerOpen}
        document={viewerDocument}
        onClose={closeViewer}
        viewUrlPrefix="/api/admin/documents"
        downloadUrlPrefix="/api/admin/documents"
        titlePrefix="Vorschau: "
        size="4xl"
      />
    </main>
  );
}

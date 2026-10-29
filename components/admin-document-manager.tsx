"use client";

import { useMemo, useState } from "react";
import { BackLink } from "@/components/back-link";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { DocumentViewer } from "@/components/document-viewer";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { IconButton } from "@/components/icon-button";
import { LoadingScreen } from "@/components/loading-screen";
import { canAccessAdminArea, canManageAdminArea } from "@/lib/role-utils";
import { useDocumentsList } from "@/lib/use-documents-list";
import { useDocumentUpload, type DocumentAreaType } from "@/lib/use-document-upload";
import { useDocumentDirectoryCrud } from "@/lib/use-document-directory-crud";
import { useDocumentMove } from "@/lib/use-document-move";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";
import { AlertBox } from "./alert-box";
import { DocumentUpload } from "./admin-documents/document-upload";
import { DirectoryManager } from "./admin-documents/directory-manager";
import { DocumentList } from "./admin-documents/document-list";
import { DocumentEditModal } from "./admin-documents/document-edit-modal";

export type { DocumentAreaType };

type AdminDocumentManagerProps = {
  area: DocumentAreaType;
  title: string;
  listTitle: string;
  description: string;
  backLabel?: string;
};

export function AdminDocumentManager({ area, title, listTitle, description, backLabel = "Zurück zum Dashboard" }: AdminDocumentManagerProps) {
  const confirm = useConfirmDialog();
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scopedQueryParams = useMemo(() => ({ area }), [area]);

  const documentsList = useDocumentsList({
    documentsApiPrefix: "/api/admin/documents",
    directoriesApiPrefix: "/api/admin/document-directories",
    accessCheck: canAccessAdminArea,
    documentsQueryParams: scopedQueryParams,
    directoriesQueryParams: scopedQueryParams,
  });
  const {
    status,
    currentUser,
    documents,
    isLoading,
    error,
    searchQuery,
    directories,
    selectedDirectory,
    maxUploadMb,
    setSelectedDirectory,
    setPage,
    reload,
    reloadDirectories,
  } = documentsList;
  const canManage = currentUser ? canManageAdminArea(currentUser) : false;
  const isSearchActive = searchQuery.trim().length > 0;
  const visibleError = actionError || error;

  const upload = useDocumentUpload({
    area,
    maxUploadMb,
    selectedDirectory,
    setActionError,
    setSuccess,
    onUploaded: async () => {
      setPage(1);
      await Promise.all([
        reloadDirectories(),
        reload(),
      ]);
    },
  });

  const directoryCrud = useDocumentDirectoryCrud({
    area,
    selectedDirectory,
    setSelectedDirectory,
    setPage,
    reload,
    confirm,
    setActionError,
    setSuccess,
  });

  const move = useDocumentMove({
    documents,
    directories,
    canDrag: canManage && selectedDirectory === "root" && !isSearchActive,
    reload,
    setActionError,
    setSuccess,
  });

  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<DocumentItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openEditModal = (document: DocumentItem) => {
    setEditingDocument(document);
    setActionError(null);
    setSuccess(null);
  };

  const handleDelete = async (document: DocumentItem) => {
    setActionError(null);
    setSuccess(null);

    if (!await confirm({
      message: `Soll das Dokument "${document.displayName}" wirklich gelöscht werden?`,
      confirmLabel: "Löschen",
      variant: "danger",
    })) return;

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

  const openViewer = (document: DocumentItem) => {
    setViewerDocument(document);
    setIsViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerDocument(null);
    setIsViewerOpen(false);
  };

  const directoryActions = (directory: DocumentDirectoryItem) => canManage ? (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <IconButton
        label="Verzeichnis umbenennen"
        onClick={(event) => {
          event.stopPropagation();
          directoryCrud.startRenameDirectory(directory);
        }}
      >
        <PencilIcon className="w-4 h-4 text-gray-700" />
      </IconButton>
      <IconButton
        label="Verzeichnis löschen"
        className="text-red-700"
        onClick={(event) => {
          event.stopPropagation();
          void directoryCrud.deleteDirectory(directory);
        }}
      >
        <TrashIcon className="w-4 h-4 text-red-700" />
      </IconButton>
    </div>
  ) : null;

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
  ) : null;

  if (status === "loading" || isLoading) {
    return <LoadingScreen className="min-h-screen flex items-center justify-center" />;
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

        <AlertBox type="error" message={visibleError} className="mb-4" />

        <AlertBox type="success" message={success} className="mb-4" />

        {canManage && (
          <DocumentUpload upload={upload} directories={directories} maxUploadMb={maxUploadMb} />
        )}

        <DocumentList
          listTitle={listTitle}
          downloadUrlPrefix="/api/admin/documents"
          list={documentsList}
          move={move}
          onOpenViewer={openViewer}
          renderDirectoryActions={directoryActions}
          renderDocumentActions={documentActions}
          directoryManager={
            <DirectoryManager
              canManage={canManage}
              selectedDirectory={selectedDirectory}
              directoryCrud={directoryCrud}
            />
          }
        />
      </div>

      {canManage && (
        <DocumentEditModal
          isOpen={editingDocument !== null}
          document={editingDocument}
          directories={directories}
          onClose={() => setEditingDocument(null)}
          onSaved={async () => {
            setSuccess("Dokument wurde aktualisiert.");
            await reload();
          }}
        />
      )}

      <DocumentViewer
        isOpen={isViewerOpen}
        document={viewerDocument}
        onClose={closeViewer}
        viewUrlPrefix="/api/admin/documents"
        titlePrefix="Vorschau: "
      />
    </main>
  );
}

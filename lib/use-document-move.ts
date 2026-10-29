"use client";

import { type DragEvent, useState } from "react";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

interface UseDocumentMoveOptions {
  documents: DocumentItem[];
  directories: DocumentDirectoryItem[];
  // Verschieben ist nur aus der Wurzelansicht ohne aktive Suche und mit
  // Verwaltungsrechten erlaubt — der Aufrufer liefert die fertige Bedingung.
  canDrag: boolean;
  reload: () => Promise<void>;
  setActionError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
}

export type DocumentMoveState = ReturnType<typeof useDocumentMove>;

// Dokument per Drag&Drop aus der Liste in ein Verzeichnis verschieben.
export function useDocumentMove({
  documents,
  directories,
  canDrag,
  reload,
  setActionError,
  setSuccess,
}: UseDocumentMoveOptions) {
  const [draggingDocumentId, setDraggingDocumentId] = useState<string | null>(null);
  const [dropTargetDirectoryId, setDropTargetDirectoryId] = useState<string | null>(null);
  const [isMovingDocument, setIsMovingDocument] = useState(false);

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
    if (!canDrag || isMovingDocument) {
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

  return {
    canDrag,
    isMovingDocument,
    dropTargetDirectoryId,
    handleDocumentDragStart,
    handleDocumentDragEnd,
    handleDirectoryDragOver,
    handleDirectoryDragLeave,
    handleDirectoryDrop,
  };
}

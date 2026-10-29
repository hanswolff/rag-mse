"use client";

import { type FormEvent, useState } from "react";
import type { DirectoryFilter } from "@/lib/document-utils";
import type { DocumentDirectoryItem } from "@/types";
import type { DocumentAreaType } from "@/lib/use-document-upload";

type ConfirmFn = (options: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}) => Promise<boolean>;

interface UseDocumentDirectoryCrudOptions {
  area: DocumentAreaType;
  selectedDirectory: DirectoryFilter;
  setSelectedDirectory: (directory: DirectoryFilter) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
  confirm: ConfirmFn;
  setActionError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
}

export type DocumentDirectoryCrudState = ReturnType<typeof useDocumentDirectoryCrud>;

// Lokaler Helfer, bis ein zentrales apiFetch existiert (siehe Review 2026-08).
async function requestJson(url: string, init: RequestInit, fallbackError: string): Promise<void> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackError);
  }
}

// Anlegen, Umbenennen und Löschen von Dokument-Verzeichnissen.
export function useDocumentDirectoryCrud({
  area,
  selectedDirectory,
  setSelectedDirectory,
  setPage,
  reload,
  confirm,
  setActionError,
  setSuccess,
}: UseDocumentDirectoryCrudOptions) {
  const [newDirectoryName, setNewDirectoryName] = useState("");
  const [isSavingDirectory, setIsSavingDirectory] = useState(false);
  const [renamingDirectoryId, setRenamingDirectoryId] = useState<string | null>(null);
  const [renamingDirectoryName, setRenamingDirectoryName] = useState("");

  const handleCreateDirectory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      await requestJson(
        "/api/admin/document-directories",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newDirectoryName, area }),
        },
        "Verzeichnis konnte nicht erstellt werden",
      );

      setNewDirectoryName("");
      setSuccess("Verzeichnis wurde erstellt.");
      await reload();
    } catch (createError: unknown) {
      setActionError(createError instanceof Error ? createError.message : "Verzeichnis konnte nicht erstellt werden");
    } finally {
      setIsSavingDirectory(false);
    }
  };

  const startRenameDirectory = (directory: DocumentDirectoryItem) => {
    setRenamingDirectoryId(directory.id);
    setRenamingDirectoryName(directory.name);
    setActionError(null);
    setSuccess(null);
  };

  const cancelRenameDirectory = () => {
    setRenamingDirectoryId(null);
    setRenamingDirectoryName("");
  };

  const saveRenameDirectory = async () => {
    if (!renamingDirectoryId) return;

    setActionError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      await requestJson(
        `/api/admin/document-directories/${renamingDirectoryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renamingDirectoryName }),
        },
        "Verzeichnis konnte nicht umbenannt werden",
      );

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

  const deleteDirectory = async (directory: DocumentDirectoryItem) => {
    if (!await confirm({
      message: `Soll das Verzeichnis "${directory.name}" wirklich gelöscht werden?`,
      confirmLabel: "Löschen",
      variant: "danger",
    })) return;

    setActionError(null);
    setSuccess(null);
    setIsSavingDirectory(true);

    try {
      await requestJson(
        `/api/admin/document-directories/${directory.id}`,
        { method: "DELETE" },
        "Verzeichnis konnte nicht gelöscht werden",
      );

      // War das gelöschte Verzeichnis geöffnet, zurück zur Wurzel; das
      // Upload-Ziel folgt der Auswahl über useDocumentUpload automatisch.
      if (selectedDirectory === directory.id) {
        setSelectedDirectory("root");
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

  return {
    newDirectoryName,
    setNewDirectoryName,
    isSavingDirectory,
    renamingDirectoryId,
    renamingDirectoryName,
    setRenamingDirectoryName,
    handleCreateDirectory,
    startRenameDirectory,
    cancelRenameDirectory,
    saveRenameDirectory,
    deleteDirectory,
  };
}

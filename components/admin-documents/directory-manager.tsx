import { FormEvent, ReactNode } from "react";
import type { DirectoryFilter } from "@/lib/document-utils";

type DirectoryManagerProps = {
  canManage: boolean;
  selectedDirectory: DirectoryFilter;
  newDirectoryName: string;
  onNewDirectoryNameChange: (name: string) => void;
  onCreateDirectory: (event: FormEvent<HTMLFormElement>) => void;
  isSavingDirectory: boolean;
  renamingDirectoryId: string | null;
  renamingDirectoryName: string;
  onRenamingDirectoryNameChange: (name: string) => void;
  onSaveRenameDirectory: () => void;
  onCancelRename: () => void;
};

export function DirectoryManager({
  canManage,
  selectedDirectory,
  newDirectoryName,
  onNewDirectoryNameChange,
  onCreateDirectory,
  isSavingDirectory,
  renamingDirectoryId,
  renamingDirectoryName,
  onRenamingDirectoryNameChange,
  onSaveRenameDirectory,
  onCancelRename,
}: DirectoryManagerProps): ReactNode {
  if (!canManage) return null;

  return (
    <>
      {selectedDirectory === "root" && (
        <form onSubmit={onCreateDirectory} className="mb-3 flex w-full md:w-auto gap-2">
          <input
            type="text"
            className="form-input w-full md:w-72"
            placeholder="Neues Verzeichnis"
            value={newDirectoryName}
            onChange={(event) => onNewDirectoryNameChange(event.target.value)}
            maxLength={120}
            disabled={isSavingDirectory}
          />
          <button type="submit" className="btn-primary px-4 py-2 text-base whitespace-nowrap" disabled={isSavingDirectory}>
            Verzeichnis erstellen
          </button>
        </form>
      )}

      {renamingDirectoryId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSaveRenameDirectory();
          }}
          className="mb-3 border border-gray-200 rounded-md bg-white p-3 flex flex-col sm:flex-row gap-2 sm:items-center"
        >
          <label htmlFor="rename-directory-input" className="text-sm font-medium text-gray-700 whitespace-nowrap">Verzeichnis umbenennen</label>
          <input
            id="rename-directory-input"
            type="text"
            className="form-input sm:w-80"
            value={renamingDirectoryName}
            onChange={(event) => onRenamingDirectoryNameChange(event.target.value)}
            maxLength={120}
            disabled={isSavingDirectory}
          />
          <button type="submit" className="btn-primary px-3 py-2 text-sm" disabled={isSavingDirectory}>
            Speichern
          </button>
          <button
            type="button"
            className="btn-outline px-3 py-2 text-sm"
            onClick={onCancelRename}
            disabled={isSavingDirectory}
          >
            Abbrechen
          </button>
        </form>
      )}
    </>
  );
}

"use client";

import { ArrowUpIcon } from "@/components/icons";
import { pluralize } from "@/lib/pluralization";
import type { DocumentDirectoryItem } from "@/types";
import type { DirectoryFilter } from "@/lib/document-utils";

interface DocumentBreadcrumbProps {
  directories: DocumentDirectoryItem[];
  selectedDirectory: DirectoryFilter;
  rootCount: number;
  currentCount: number;
  onNavigateRoot: () => void;
  showUpButton?: boolean;
}

export function DocumentBreadcrumb({
  directories,
  selectedDirectory,
  rootCount,
  currentCount,
  onNavigateRoot,
  showUpButton = false,
}: DocumentBreadcrumbProps) {
  const currentDirectory = selectedDirectory === "root"
    ? null
    : directories.find((directory) => directory.id === selectedDirectory) || null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm border border-gray-200 rounded-md bg-gray-50 px-3 py-2">
      <button type="button" className="link-primary font-medium" onClick={onNavigateRoot}>
        /
      </button>
      {currentDirectory && (
        <>
          <span className="text-gray-400">›</span>
          <span className="text-gray-700 font-medium">{currentDirectory.name}</span>
          {showUpButton && (
            <button
              type="button"
              className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              onClick={onNavigateRoot}
              aria-label="Zum übergeordneten Verzeichnis"
              title="Zum übergeordneten Verzeichnis"
            >
              <ArrowUpIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
      <span className="ml-auto text-gray-500">
        {selectedDirectory === "root"
          ? `${directories.length} ${pluralize(directories.length, "Verzeichnis", "Verzeichnisse")}, ${rootCount} ${pluralize(rootCount, "Datei", "Dateien")}`
          : `${currentCount} ${pluralize(currentCount, "Datei", "Dateien")}`}
      </span>
    </div>
  );
}

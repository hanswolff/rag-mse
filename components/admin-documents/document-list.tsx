import { DragEvent, FormEvent, ReactNode } from "react";
import { Pagination } from "@/components/pagination";
import { DocumentBreadcrumb } from "@/components/document-breadcrumb";
import { DocumentTableHeader, DirectoryRow, DocumentRow, EmptyRow } from "@/components/document-table";
import type { DocumentSortField, DocumentSortDirection, DirectoryFilter } from "@/lib/document-utils";
import { pluralize } from "@/lib/pluralization";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

type DocumentListProps = {
  listTitle: string;
  documents: DocumentItem[];
  directories: DocumentDirectoryItem[];
  selectedDirectory: DirectoryFilter;
  rootCount: number;
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  searchInput: string;
  searchQuery: string;
  isSearchActive: boolean;
  sortBy: DocumentSortField;
  sortDir: DocumentSortDirection;
  canManage: boolean;
  isMovingDocument: boolean;
  downloadUrlPrefix: string;
  dropTargetDirectoryId: string | null;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClearSearch: () => void;
  onSortChange: (field: DocumentSortField) => void;
  onPageChange: (page: number) => void;
  onNavigateRoot: () => void;
  onNavigateToDirectory: (directoryId: string) => void;
  onOpenViewer: (document: DocumentItem) => void;
  renderDirectoryActions: (directory: DocumentDirectoryItem) => ReactNode;
  renderDocumentActions: (document: DocumentItem) => ReactNode;
  onDocumentDragStart: (event: DragEvent<HTMLTableRowElement>, document: DocumentItem) => void;
  onDocumentDragEnd: () => void;
  onDirectoryDragOver: (event: DragEvent<HTMLTableRowElement>, directoryId: string) => void;
  onDirectoryDragLeave: (event: DragEvent<HTMLTableRowElement>, directoryId: string) => void;
  onDirectoryDrop: (event: DragEvent<HTMLTableRowElement>, directoryId: string) => void;
  directoryManager?: ReactNode;
};

export function DocumentList({
  listTitle,
  documents,
  directories,
  selectedDirectory,
  rootCount,
  total,
  page,
  totalPages,
  isLoading,
  searchInput,
  searchQuery,
  isSearchActive,
  sortBy,
  sortDir,
  canManage,
  isMovingDocument,
  downloadUrlPrefix,
  dropTargetDirectoryId,
  onSearchInputChange,
  onSubmitSearch,
  onClearSearch,
  onSortChange,
  onPageChange,
  onNavigateRoot,
  onNavigateToDirectory,
  onOpenViewer,
  renderDirectoryActions,
  renderDocumentActions,
  onDocumentDragStart,
  onDocumentDragEnd,
  onDirectoryDragOver,
  onDirectoryDragLeave,
  onDirectoryDrop,
  directoryManager,
}: DocumentListProps): ReactNode {
  return (
    <section className="card-compact">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{listTitle}</h2>
          <p className="text-base text-gray-600 mt-1">{total} {pluralize(total, "Datei", "Dateien")}</p>
        </div>
        <form onSubmit={onSubmitSearch} className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
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
          <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={onClearSearch}>
            Suche zurücksetzen
          </button>
        </div>
      )}

      {directoryManager}

      <DocumentBreadcrumb
        directories={directories}
        selectedDirectory={selectedDirectory}
        rootCount={rootCount}
        currentCount={total}
        onNavigateRoot={onNavigateRoot}
        showUpButton={selectedDirectory !== "root"}
      />

      <div className="overflow-x-auto border border-gray-200 rounded-md bg-white">
        <table className="min-w-full">
          <DocumentTableHeader sortBy={sortBy} sortDir={sortDir} onSortChange={onSortChange} />
          <tbody>
            {selectedDirectory === "root" && !isSearchActive && directories.map((directory) => (
              <DirectoryRow
                key={directory.id}
                directory={directory}
                searchQuery={searchQuery}
                onNavigate={onNavigateToDirectory}
                actions={renderDirectoryActions(directory)}
                isDropTarget={dropTargetDirectoryId === directory.id}
                onDragOver={(event) => onDirectoryDragOver(event, directory.id)}
                onDragLeave={(event) => onDirectoryDragLeave(event, directory.id)}
                onDrop={(event) => {
                  void onDirectoryDrop(event, directory.id);
                }}
              />
            ))}

            {documents.length > 0 ? (
              documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  searchQuery={searchQuery}
                  downloadUrlPrefix={downloadUrlPrefix}
                  onOpen={onOpenViewer}
                  actions={renderDocumentActions(document)}
                  draggable={canManage && selectedDirectory === "root" && !isSearchActive && !isMovingDocument}
                  onDragStart={(event) => onDocumentDragStart(event, document)}
                  onDragEnd={onDocumentDragEnd}
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

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} disabled={isLoading} />
    </section>
  );
}

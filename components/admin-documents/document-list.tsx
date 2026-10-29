import type { ReactNode } from "react";
import { Pagination } from "@/components/pagination";
import { DocumentBreadcrumb } from "@/components/document-breadcrumb";
import { DocumentTableHeader, DirectoryRow, DocumentRow, EmptyRow } from "@/components/document-table";
import type { useDocumentsList } from "@/lib/use-documents-list";
import type { DocumentMoveState } from "@/lib/use-document-move";
import { pluralize } from "@/lib/pluralization";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

type DocumentsListState = ReturnType<typeof useDocumentsList>;

type DocumentListProps = {
  listTitle: string;
  downloadUrlPrefix: string;
  list: DocumentsListState;
  move: DocumentMoveState;
  onOpenViewer: (document: DocumentItem) => void;
  renderDirectoryActions: (directory: DocumentDirectoryItem) => ReactNode;
  renderDocumentActions: (document: DocumentItem) => ReactNode;
  directoryManager?: ReactNode;
};

export function DocumentList({
  listTitle,
  downloadUrlPrefix,
  list,
  move,
  onOpenViewer,
  renderDirectoryActions,
  renderDocumentActions,
  directoryManager,
}: DocumentListProps): ReactNode {
  const {
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
    sortBy,
    sortDir,
    setSearchInput,
    handleSubmitSearch,
    clearSearch,
    handleSortChange,
    setPage,
    navigateToRoot,
    navigateToDirectory,
  } = list;
  const isSearchActive = searchQuery.trim().length > 0;

  return (
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
            aria-label="Suche nach Dokumentenname"
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

      {directoryManager}

      <DocumentBreadcrumb
        directories={directories}
        selectedDirectory={selectedDirectory}
        rootCount={rootCount}
        currentCount={total}
        onNavigateRoot={navigateToRoot}
        showUpButton={selectedDirectory !== "root"}
      />

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
                actions={renderDirectoryActions(directory)}
                isDropTarget={move.dropTargetDirectoryId === directory.id}
                onDragOver={(event) => move.handleDirectoryDragOver(event, directory.id)}
                onDragLeave={(event) => move.handleDirectoryDragLeave(event, directory.id)}
                onDrop={(event) => {
                  void move.handleDirectoryDrop(event, directory.id);
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
                  draggable={move.canDrag && !move.isMovingDocument}
                  onDragStart={(event) => move.handleDocumentDragStart(event, document)}
                  onDragEnd={move.handleDocumentDragEnd}
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
  );
}

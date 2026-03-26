"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BackLink } from "@/components/back-link";
import { Pagination } from "@/components/pagination";
import { DocumentBreadcrumb } from "@/components/document-breadcrumb";
import { DocumentTableHeader, DirectoryRow, DocumentRow, EmptyRow } from "@/components/document-table";
import { DocumentViewer } from "@/components/document-viewer";
import { API_ROUTES } from "@/lib/api-routes";
import { LoadingScreen } from "@/components/loading-screen";
import { useDocumentsList } from "@/lib/use-documents-list";
import { canManageMemberDocuments, canReadMemberDocuments } from "@/lib/role-utils";
import { pluralize } from "@/lib/pluralization";
import type { DocumentItem } from "@/types";
import { AlertBox } from "@/components/alert-box";

export default function MemberDocumentsPage() {
  const { data: session } = useSession();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<DocumentItem | null>(null);

  const {
    status,
    isLoading,
    error,
    documents,
    total,
    page,
    totalPages,
    directories,
    selectedDirectory,
    rootCount,
    searchInput,
    searchQuery,
    sortBy,
    sortDir,
    handleSortChange,
    setSearchInput,
    handleSubmitSearch,
    clearSearch,
    setPage,
    navigateToRoot,
    navigateToDirectory,
  } = useDocumentsList({
    documentsApiPrefix: API_ROUTES.MEMBER.DOCUMENTS,
    directoriesApiPrefix: API_ROUTES.MEMBER.DOCUMENT_DIRECTORIES,
    accessCheck: canReadMemberDocuments,
  });

  const openViewer = useCallback((document: DocumentItem) => {
    setViewerDocument(document);
    setIsViewerOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerDocument(null);
    setIsViewerOpen(false);
  }, []);

  const isSearchActive = searchQuery.trim().length > 0;
  const canOpenAdminMemberDocuments = canManageMemberDocuments(session?.user);
  const isInitialLoading = status === "loading" || (isLoading && documents.length === 0 && directories.length === 0 && !error);

  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/" className="text-base">
            Zurück zur Startseite
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Dokumente für Mitglieder</h1>
          <p className="text-base text-gray-600 mt-2">Dokumente für Mitglieder durchsuchen und ansehen</p>
          {canOpenAdminMemberDocuments && (
            <div className="mt-4">
              <Link href="/admin/mitglied-dokumente" className="btn-primary px-4 py-2 text-base">
                Zum Adminbereich Mitglieder-Dokumente
              </Link>
            </div>
          )}
        </div>

        <AlertBox type="error" message={error} className="mb-4" />

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Dokumente</h2>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-base text-gray-600">{total} {pluralize(total, "Datei", "Dateien")}</p>
                {isLoading && <span className="text-sm text-gray-500">Aktualisiere...</span>}
              </div>
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
              <DocumentTableHeader
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={handleSortChange}
              />
              <tbody>
                {selectedDirectory === "root" && !isSearchActive && directories.map((directory) => (
                  <DirectoryRow
                    key={directory.id}
                    directory={directory}
                    searchQuery={searchQuery}
                    onNavigate={navigateToDirectory}
                  />
                ))}

                {documents.length > 0 ? (
                  documents.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      searchQuery={searchQuery}
                      downloadUrlPrefix={API_ROUTES.MEMBER.DOCUMENTS}
                      onOpen={openViewer}
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

      <DocumentViewer
        isOpen={isViewerOpen}
        document={viewerDocument}
        onClose={closeViewer}
        viewUrlPrefix={API_ROUTES.MEMBER.DOCUMENTS}
      />
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/modal";
import { LoadingIndicator } from "@/components/loading-indicator";
import { DownloadDocumentIcon, ChevronDownIcon } from "@/components/icons";
import { formatDateUtc, formatFileSize } from "@/lib/document-utils";
import { API_ROUTES } from "@/lib/api-routes";
import type { AusschreibungItem } from "@/types";

const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
      <LoadingIndicator size="md" className="text-gray-400" />
      <span>PDF wird geladen…</span>
    </div>
  ),
});

function getFileUrl(id: string, download: boolean): string {
  const suffix = download ? "?download=true" : "";
  return `${API_ROUTES.AUSSCHREIBUNGEN}/${id}/file${suffix}`;
}

function AusschreibungCard({
  ausschreibung,
  onView,
}: {
  ausschreibung: AusschreibungItem;
  onView: (ausschreibung: AusschreibungItem) => void;
}) {
  return (
    <article className="card-compact">
      <div className="p-4 sm:p-6">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900">{ausschreibung.title}</h2>
        <p className="text-base sm:text-base text-gray-500 mt-1">
          Datum: {formatDateUtc(ausschreibung.expiresAt)}
        </p>
        {ausschreibung.description && (
          <p className="text-gray-600 mt-3 whitespace-pre-wrap text-base sm:text-base">
            {ausschreibung.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => onView(ausschreibung)}
            className="btn-secondary w-full sm:w-auto text-sm sm:text-base"
          >
            PDF ansehen
          </button>
          <a
            href={getFileUrl(ausschreibung.id, true)}
            className="document-download-link document-download-link-download text-sm sm:text-base"
          >
            <DownloadDocumentIcon className="h-4 w-4" />
            Herunterladen ({formatFileSize(ausschreibung.sizeBytes)})
          </a>
        </div>
      </div>
    </article>
  );
}

export function AusschreibungenList({
  current,
  historical,
}: {
  current: AusschreibungItem[];
  historical: AusschreibungItem[];
}) {
  const [viewing, setViewing] = useState<AusschreibungItem | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const viewerSource = useMemo(
    () => (viewing ? getFileUrl(viewing.id, false) : null),
    [viewing]
  );

  return (
    <div className="space-y-8">
      <section>
        {current.length === 0 ? (
          <div className="card empty-state">
            <p className="text-gray-500 text-base sm:text-lg font-medium">Derzeit keine aktuellen Ausschreibungen</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {current.map((ausschreibung) => (
              <AusschreibungCard key={ausschreibung.id} ausschreibung={ausschreibung} onView={setViewing} />
            ))}
          </div>
        )}
      </section>

      {historical.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setIsArchiveOpen((open) => !open)}
            aria-expanded={isArchiveOpen}
            className="w-full flex items-center justify-between px-4 py-3 bg-white shadow rounded-lg text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>Frühere Ausschreibungen ({historical.length})</span>
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform duration-200 ${isArchiveOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isArchiveOpen && (
            <div className="space-y-4 sm:space-y-6 mt-4">
              {historical.map((ausschreibung) => (
                <AusschreibungCard key={ausschreibung.id} ausschreibung={ausschreibung} onView={setViewing} />
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? viewing.title : "Ausschreibung ansehen"}
        size="full"
      >
        {viewerSource && <PdfViewer source={viewerSource} />}
      </Modal>
    </div>
  );
}

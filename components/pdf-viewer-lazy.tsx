"use client";

import dynamic from "next/dynamic";
import { LoadingIndicator } from "@/components/loading-indicator";

// Gemeinsamer Lazy-Import des PDF-Viewers (kein SSR, einheitlicher Ladezustand).
// Stand zuvor wortgleich in admin-ausschreibung-manager, ausschreibungen-list
// und document-viewer.
export const PdfViewerLazy = dynamic(() => import("@/components/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
      <LoadingIndicator size="md" className="text-gray-400" />
      <span>PDF wird geladen…</span>
    </div>
  ),
});

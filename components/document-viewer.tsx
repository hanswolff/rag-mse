"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Modal } from "@/components/modal";
import type { DocumentItem } from "@/types";

import { LoadingIndicator } from "@/components/loading-indicator";

const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
      <LoadingIndicator size="md" className="text-gray-400" />
      <span>PDF wird geladen…</span>
    </div>
  ),
});

interface DocumentViewerProps {
  isOpen: boolean;
  document: DocumentItem | null;
  onClose: () => void;
  viewUrlPrefix: string;
  titlePrefix?: string;
  size?: "sm" | "md" | "lg" | "xl" | "4xl";
}

export function DocumentViewer({
  isOpen,
  document,
  onClose,
  viewUrlPrefix,
  titlePrefix = "",
  size = "lg",
}: DocumentViewerProps) {
  const viewerContent = useMemo(() => {
    if (!document) {
      return null;
    }

    const source = `${viewUrlPrefix}/${document.id}/view`;

    if (document.mimeType === "application/pdf") {
      return <PdfViewer source={source} />;
    }

    if (document.mimeType.startsWith("image/")) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded border border-gray-200 overflow-auto max-h-[70vh]">
          <Image
            src={source}
            alt={document.displayName}
            className="max-w-full h-auto"
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "auto", height: "auto" }}
            unoptimized
          />
        </div>
      );
    }

    return <p className="text-gray-600">Dieser Dateityp kann nicht direkt angezeigt werden.</p>;
  }, [document, viewUrlPrefix]);

  const title = document ? `${titlePrefix}${document.displayName}` : "Dokument anzeigen";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
    >
      {viewerContent}
    </Modal>
  );
}

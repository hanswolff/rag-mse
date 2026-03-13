"use client";

import { useMemo } from "react";
import { Modal } from "@/components/modal";
import type { DocumentItem } from "@/types";

interface DocumentViewerProps {
  isOpen: boolean;
  document: DocumentItem | null;
  onClose: () => void;
  viewUrlPrefix: string;
  downloadUrlPrefix: string;
  titlePrefix?: string;
  size?: "sm" | "md" | "lg" | "xl" | "4xl";
}

export function DocumentViewer({
  isOpen,
  document,
  onClose,
  viewUrlPrefix,
  downloadUrlPrefix,
  titlePrefix = "",
  size = "lg",
}: DocumentViewerProps) {
  const viewerContent = useMemo(() => {
    if (!document) {
      return null;
    }

    const source = `${viewUrlPrefix}/${document.id}/view`;

    if (document.mimeType === "application/pdf") {
      return (
        <iframe
          src={source}
          title={document.displayName}
          className="w-full h-[70vh] border border-gray-200 rounded"
        />
      );
    }

    if (document.mimeType.startsWith("image/")) {
      return (
        <iframe
          src={source}
          title={document.displayName}
          className="w-full h-[70vh] border border-gray-200 rounded bg-gray-100"
        />
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
      contentOverflow="visible"
    >
      {viewerContent}
      {document && (
        <div className="mt-4 flex justify-end">
          <a
            href={`${downloadUrlPrefix}/${document.id}/download`}
            className="btn-primary px-4 py-2 text-base"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        </div>
      )}
    </Modal>
  );
}

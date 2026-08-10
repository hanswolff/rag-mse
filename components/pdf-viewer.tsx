"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { LoadingIndicator } from "@/components/loading-indicator";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const VIEWPORT_MARGIN = "600px";

// Seitenrand innerhalb des Scroll-Containers, damit die Seite nicht am Rahmen klebt.
const PAGE_HORIZONTAL_PADDING = 32;

// Obergrenze rein als Schutz vor riesigen Canvas-Flächen: react-pdf rendert mit
// Breite × devicePixelRatio, auf 4K-Displays wären das sonst mehrere tausend
// Pixel pro Seite. Bis dahin füllt die Seite den Container vollständig aus.
const MAX_PAGE_WIDTH = 2000;

function PageLoadingPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-gray-400"
      style={{ height }}
    >
      <LoadingIndicator size="md" className="text-gray-400" />
    </div>
  );
}

function LazyPage({
  pageNumber,
  width,
  scrollRoot,
}: {
  pageNumber: number;
  width: number | undefined;
  scrollRoot: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { root: scrollRoot, rootMargin: VIEWPORT_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  const estimatedHeight = width ? Math.round(width * 1.414) : 800;

  return (
    <div
      ref={ref}
      style={{ minHeight: isVisible ? undefined : estimatedHeight }}
    >
      {isVisible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          loading={<PageLoadingPlaceholder height={estimatedHeight} />}
        />
      ) : (
        <PageLoadingPlaceholder height={estimatedHeight} />
      )}
    </div>
  );
}

export function PdfViewer({ source }: { source: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(
    undefined
  );
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setScrollRoot(container);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    []
  );

  const pageWidth = containerWidth
    ? Math.min(containerWidth - PAGE_HORIZONTAL_PADDING, MAX_PAGE_WIDTH)
    : undefined;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-gray-100 rounded border border-gray-200"
      >
        <Document
          file={source}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
              <LoadingIndicator size="md" className="text-gray-400" />
              <span>PDF wird geladen…</span>
            </div>
          }
          error={
            <div className="flex items-center justify-center p-8 text-red-600">
              PDF konnte nicht geladen werden.
            </div>
          }
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {numPages &&
              Array.from({ length: numPages }, (_, i) => (
                <LazyPage
                  key={i + 1}
                  pageNumber={i + 1}
                  width={pageWidth}
                  scrollRoot={scrollRoot}
                />
              ))}
          </div>
        </Document>
      </div>
    </div>
  );
}

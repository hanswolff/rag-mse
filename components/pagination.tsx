"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
} & (
  | { onPageChange: (page: number) => void; disabled?: boolean; basePath?: never }
  | { basePath: string; onPageChange?: never; disabled?: never }
);

function getPageNumbers(current: number, total: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const maxVisible = 5;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else if (current <= 3) {
    pages.push(1, 2, 3, 4, "...", total);
  } else if (current >= total - 2) {
    pages.push(1, "...", total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}

function buildHref(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

function Ellipsis({ index }: { index: number }) {
  return (
    <span key={`ellipsis-${index}`} className="px-3 py-2 text-base text-gray-500" aria-hidden="true">
      ...
    </span>
  );
}

const ROOT_CLASSES = "mt-8 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-2";
const PAGES_CLASSES = "flex flex-wrap justify-center gap-1";
const STEP_CLASSES = "px-3 sm:px-4 py-2 text-base rounded-md w-full sm:w-auto text-center";
const PAGE_ACTIVE_CLASSES = "bg-brand-red-600 text-white";
const PAGE_INACTIVE_CLASSES = "bg-white border border-brand-blue-200 hover:bg-brand-blue-50 text-brand-blue-900";

// Gemeinsames Gerüst beider Zweige: Zurück-Steuerung, Seitenliste, Weiter-Steuerung.
// Der Link-Zweig rendert eine <nav>, der Button-Zweig hält die Navigationsrolle
// auf dem Seitenlisten-Container.
function renderPageItems(pageNumbers: (number | string)[], renderPage: (pageNum: number) => ReactNode): ReactNode {
  return pageNumbers.map((pageNum, index) =>
    pageNum === "..." ? <Ellipsis key={`ellipsis-${index}`} index={index} /> : renderPage(pageNum as number)
  );
}

function StepLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${STEP_CLASSES} pointer-events-none bg-gray-100 text-gray-400 border border-gray-200`}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${STEP_CLASSES} bg-white border border-brand-blue-200 hover:bg-brand-blue-50`}>
      {label}
    </Link>
  );
}

function StepButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 sm:px-4 py-2 text-base bg-white border border-brand-blue-200 rounded-md hover:bg-brand-blue-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
      aria-label={label}
    >
      {label}
    </button>
  );
}

export function Pagination(props: PaginationProps) {
  const { currentPage, totalPages } = props;

  if (totalPages <= 1) return null;

  const normalizedCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const pageNumbers = getPageNumbers(normalizedCurrentPage, totalPages);
  const prevDisabled = normalizedCurrentPage === 1;
  const nextDisabled = normalizedCurrentPage === totalPages;

  if ("basePath" in props && props.basePath != null) {
    const { basePath } = props;

    return (
      <nav className={ROOT_CLASSES} aria-label="Seitennavigation">
        <StepLink disabled={prevDisabled} href={buildHref(basePath, normalizedCurrentPage - 1)} label="Zurück" />

        <div className={PAGES_CLASSES}>
          {renderPageItems(pageNumbers, (pageNum) => (
            <Link
              key={pageNum}
              href={buildHref(basePath, pageNum)}
              aria-label={`Seite ${pageNum}`}
              aria-current={normalizedCurrentPage === pageNum ? "page" : undefined}
              className={`px-3 sm:px-4 py-2 text-base rounded-md min-w-[2.5rem] font-semibold text-center ${
                normalizedCurrentPage === pageNum ? PAGE_ACTIVE_CLASSES : PAGE_INACTIVE_CLASSES
              }`}
            >
              {pageNum}
            </Link>
          ))}
        </div>

        <StepLink disabled={nextDisabled} href={buildHref(basePath, normalizedCurrentPage + 1)} label="Weiter" />
      </nav>
    );
  }

  const { onPageChange, disabled = false } = props;

  return (
    <div className={ROOT_CLASSES}>
      <StepButton disabled={prevDisabled || disabled} onClick={() => onPageChange(normalizedCurrentPage - 1)} label="Zurück" />

      <div className={PAGES_CLASSES} role="navigation" aria-label="Seitennavigation">
        {renderPageItems(pageNumbers, (pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            disabled={disabled}
            className={`px-3 sm:px-4 py-2 text-base rounded-md min-w-[2.5rem] font-semibold ${
              normalizedCurrentPage === pageNum
                ? PAGE_ACTIVE_CLASSES
                : `${PAGE_INACTIVE_CLASSES} disabled:opacity-50`
            }`}
            aria-label={`Seite ${pageNum}`}
            aria-current={normalizedCurrentPage === pageNum ? "page" : undefined}
          >
            {pageNum}
          </button>
        ))}
      </div>

      <StepButton disabled={nextDisabled || disabled} onClick={() => onPageChange(normalizedCurrentPage + 1)} label="Weiter" />
    </div>
  );
}

"use client";

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

export function Pagination(props: PaginationProps) {
  const { currentPage, totalPages } = props;

  if (totalPages <= 1) return null;

  const normalizedCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const pageNumbers = getPageNumbers(normalizedCurrentPage, totalPages);
  const prevDisabled = normalizedCurrentPage === 1;
  const nextDisabled = normalizedCurrentPage === totalPages;

  const activeClass = "bg-brand-red-600 text-white";
  const inactiveClass = "bg-white border border-brand-blue-200 hover:bg-brand-blue-50 text-brand-blue-900";

  if ("basePath" in props && props.basePath != null) {
    const { basePath } = props;
    const disabledLinkClass = "pointer-events-none bg-gray-100 text-gray-400 border border-gray-200";
    const enabledLinkClass = "bg-white border border-brand-blue-200 hover:bg-brand-blue-50";

    return (
      <nav className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-2" aria-label="Seitennavigation">
        <Link
          href={buildHref(basePath, normalizedCurrentPage - 1)}
          aria-disabled={prevDisabled}
          aria-label="Zurück"
          className={`px-3 sm:px-4 py-2 text-base rounded-md w-full sm:w-auto text-center ${prevDisabled ? disabledLinkClass : enabledLinkClass}`}
        >
          Zurück
        </Link>

        <div className="flex flex-wrap justify-center gap-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === "...") return <Ellipsis key={`ellipsis-${index}`} index={index} />;

            return (
              <Link
                key={pageNum as number}
                href={buildHref(basePath, pageNum as number)}
                aria-label={`Seite ${pageNum}`}
                aria-current={normalizedCurrentPage === pageNum ? "page" : undefined}
                className={`px-3 sm:px-4 py-2 text-base rounded-md min-w-[2.5rem] font-semibold text-center ${
                  normalizedCurrentPage === pageNum ? activeClass : inactiveClass
                }`}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>

        <Link
          href={buildHref(basePath, normalizedCurrentPage + 1)}
          aria-disabled={nextDisabled}
          aria-label="Weiter"
          className={`px-3 sm:px-4 py-2 text-base rounded-md w-full sm:w-auto text-center ${nextDisabled ? disabledLinkClass : enabledLinkClass}`}
        >
          Weiter
        </Link>
      </nav>
    );
  }

  const { onPageChange, disabled = false } = props;

  return (
    <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-2">
      <button
        onClick={() => onPageChange(normalizedCurrentPage - 1)}
        disabled={prevDisabled || disabled}
        className="px-3 sm:px-4 py-2 text-base bg-white border border-brand-blue-200 rounded-md hover:bg-brand-blue-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        aria-label="Zurück"
      >
        Zurück
      </button>

      <div className="flex flex-wrap justify-center gap-1" role="navigation" aria-label="Seitennavigation">
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "...") return <Ellipsis key={`ellipsis-${index}`} index={index} />;

          return (
            <button
              key={pageNum as number}
              onClick={() => onPageChange(pageNum as number)}
              disabled={disabled}
              className={`px-3 sm:px-4 py-2 text-base rounded-md min-w-[2.5rem] font-semibold ${
                normalizedCurrentPage === pageNum
                  ? activeClass
                  : `${inactiveClass} disabled:opacity-50`
              }`}
              aria-label={`Seite ${pageNum}`}
              aria-current={normalizedCurrentPage === pageNum ? "page" : undefined}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onPageChange(normalizedCurrentPage + 1)}
        disabled={nextDisabled || disabled}
        className="px-3 sm:px-4 py-2 text-base bg-white border border-brand-blue-200 rounded-md hover:bg-brand-blue-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        aria-label="Weiter"
      >
        Weiter
      </button>
    </div>
  );
}

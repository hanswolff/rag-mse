import Link from "next/link";

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
}

function buildHref(basePath: string, page: number) {
  if (page <= 1) {
    return basePath;
  }
  return `${basePath}?page=${page}`;
}

interface PaginationLinksProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
}

export function PaginationLinks({ basePath, currentPage, totalPages }: PaginationLinksProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Seitennavigation">
      <Link
        href={buildHref(basePath, currentPage - 1)}
        aria-disabled={currentPage <= 1}
        className={`px-3 py-2 rounded border text-base ${
          currentPage <= 1
            ? "pointer-events-none bg-gray-100 text-gray-400 border-gray-200"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Zurück
      </Link>

      {pageNumbers.map((pageNum, index) => {
        const previous = pageNumbers[index - 1];
        const showGap = previous && pageNum - previous > 1;

        return (
          <span key={pageNum} className="contents">
            {showGap && <span className="px-1 text-gray-500">...</span>}
            <Link
              href={buildHref(basePath, pageNum)}
              aria-current={pageNum === currentPage ? "page" : undefined}
              className={`px-3 py-2 rounded border text-base min-w-10 text-center ${
                pageNum === currentPage
                  ? "bg-brand-blue-900 text-white border-brand-blue-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {pageNum}
            </Link>
          </span>
        );
      })}

      <Link
        href={buildHref(basePath, currentPage + 1)}
        aria-disabled={currentPage >= totalPages}
        className={`px-3 py-2 rounded border text-base ${
          currentPage >= totalPages
            ? "pointer-events-none bg-gray-100 text-gray-400 border-gray-200"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Weiter
      </Link>
    </nav>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const maxVisible = 5;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, 4, "...", total);
    } else if (current >= total - 2) {
      pages.push(1, "...", total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, "...", current - 1, current, current + 1, "...", total);
    }
  }

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="px-3 sm:px-4 py-2 text-base sm:text-base bg-white border border-brand-blue-200 rounded-md hover:bg-brand-blue-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        aria-label="Zurück"
      >
        Zurück
      </button>

      <div className="flex flex-wrap justify-center gap-1" role="navigation" aria-label="Seitennavigation">
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-base sm:text-base text-gray-500"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          return (
            <button
              key={pageNum as number}
              onClick={() => onPageChange(pageNum as number)}
              disabled={disabled}
              className={`px-3 sm:px-4 py-2 text-base sm:text-base rounded-md min-w-[2.5rem] font-semibold ${
                currentPage === pageNum
                  ? "bg-brand-red-600 text-white"
                  : "bg-white border border-brand-blue-200 hover:bg-brand-blue-50 disabled:opacity-50 text-brand-blue-900"
              }`}
              aria-label={`Seite ${pageNum}`}
              aria-current={currentPage === pageNum ? "page" : undefined}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="px-3 sm:px-4 py-2 text-base sm:text-base bg-white border border-brand-blue-200 rounded-md hover:bg-brand-blue-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        aria-label="Weiter"
      >
        Weiter
      </button>
    </div>
  );
}

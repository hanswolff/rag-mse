"use client";

import { FormEvent, ReactNode } from "react";
import { AlertBox } from "@/components/alert-box";
import { BackLink } from "@/components/back-link";
import { Pagination } from "@/components/pagination";
import { SortableTableHeader } from "@/components/sortable-table-header";
import { TableSortDirection } from "@/lib/use-table-sorting";

const HEADER_CELL_CLASS = "px-4 py-3 text-left text-base font-semibold text-gray-700";
const ICON_HEADER_CELL_CLASS = "px-2 py-3 text-left text-base font-semibold text-gray-700 w-10";

export type AdminListColumn<TSortField extends string> = {
  label: string;
  field?: TSortField;
  srOnly?: boolean;
};

type AdminListShellProps<TSortField extends string> = {
  title: string;
  subtitle: string;
  listTitle: string;
  error: string | null;
  successMessage?: string | null;
  aboveList?: ReactNode;
  total: number;
  searchPlaceholder: string;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  columns: AdminListColumn<TSortField>[];
  sortBy: TSortField;
  sortDir: TableSortDirection;
  onSortChange: (field: TSortField) => void;
  mobileList: ReactNode;
  tableBody: ReactNode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  children?: ReactNode;
};

export function AdminListShell<TSortField extends string>({
  title,
  subtitle,
  listTitle,
  error,
  successMessage,
  aboveList,
  total,
  searchPlaceholder,
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  columns,
  sortBy,
  sortDir,
  onSortChange,
  mobileList,
  tableBody,
  page,
  totalPages,
  onPageChange,
  isLoading,
  children,
}: AdminListShellProps<TSortField>) {
  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">{title}</h1>
          <p className="text-base text-gray-600 mt-2">{subtitle}</p>
        </div>

        {aboveList}

        <AlertBox type="error" message={error} className="mb-4" />

        <AlertBox type="success" message={successMessage ?? null} className="mb-4" />

        <section className="card-compact">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{listTitle}</h2>
              <p className="text-base text-gray-600 mt-1">{total} Einträge</p>
            </div>
            <form onSubmit={onSubmitSearch} className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => onSearchInputChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="form-input w-full md:w-80"
              />
              <button type="submit" className="btn-primary px-4 py-2 text-base whitespace-nowrap w-full sm:w-auto">
                Suchen
              </button>
            </form>
          </div>

          <div className="space-y-3 md:hidden">{mobileList}</div>

          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-md bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column) => {
                    if (column.field) {
                      return (
                        <SortableTableHeader
                          key={column.field}
                          label={column.label}
                          field={column.field}
                          activeField={sortBy}
                          sortDir={sortDir}
                          onSortChange={onSortChange}
                          className={HEADER_CELL_CLASS}
                        />
                      );
                    }
                    if (column.srOnly) {
                      return (
                        <th key={column.label} scope="col" className={ICON_HEADER_CELL_CLASS}>
                          <span className="sr-only">{column.label}</span>
                        </th>
                      );
                    }
                    return (
                      <th key={column.label} scope="col" className={HEADER_CELL_CLASS}>{column.label}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>{tableBody}</tbody>
            </table>
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} disabled={isLoading} />
        </section>

        {children}
      </div>
    </main>
  );
}

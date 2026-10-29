import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TableSortDirection, useTableSorting } from "@/lib/use-table-sorting";
import { UserWithRole } from "@/lib/permissions";

export type PaginatedListPagination = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type PaginatedListResponse = {
  pagination: PaginatedListPagination;
};

const DEFAULT_PAGE_SIZE = 20;

type UsePaginatedAdminListOptions<TItem, TSortField extends string, TResponse extends PaginatedListResponse> = {
  endpoint: string;
  extractItems: (data: TResponse) => TItem[];
  loadErrorMessage: string;
  canAccess: (user: UserWithRole) => boolean;
  initialSortField: TSortField;
  initialSortDirection: TableSortDirection;
  defaultSortDirections?: Partial<Record<TSortField, TableSortDirection>>;
  extraParams?: Record<string, string>;
  pageSize?: number;
};

export function usePaginatedAdminList<TItem, TSortField extends string, TResponse extends PaginatedListResponse>({
  endpoint,
  extractItems,
  loadErrorMessage,
  canAccess,
  initialSortField,
  initialSortDirection,
  defaultSortDirections = {},
  extraParams,
  pageSize = DEFAULT_PAGE_SIZE,
}: UsePaginatedAdminListOptions<TItem, TSortField, TResponse>) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [items, setItems] = useState<TItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { sortBy, sortDir, handleSortChange } = useTableSorting<TSortField>(
    initialSortField,
    initialSortDirection,
    defaultSortDirections,
  );

  const extractItemsRef = useRef(extractItems);
  const canAccessRef = useRef(canAccess);
  useEffect(() => {
    extractItemsRef.current = extractItems;
    canAccessRef.current = canAccess;
  });

  const extraParamsKey = JSON.stringify(extraParams ?? {});
  const stableExtraParams = useMemo<Record<string, string>>(
    () => JSON.parse(extraParamsKey) as Record<string, string>,
    [extraParamsKey],
  );

  useEffect(() => {
    if (status === "authenticated" && !canAccessRef.current(session?.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  const loadRequestIdRef = useRef(0);

  const loadItems = useCallback(async (
    targetPage: number,
    query: string,
    nextSortBy: TSortField,
    nextSortDir: TableSortDirection,
  ) => {
    const requestId = ++loadRequestIdRef.current;
    const isStale = () => requestId !== loadRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(pageSize),
        sortBy: nextSortBy,
        sortDir: nextSortDir,
        ...stableExtraParams,
      });

      if (query.trim().length > 0) {
        params.set("q", query.trim());
      }

      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : loadErrorMessage);
      }

      const data = (await response.json()) as TResponse;
      if (isStale()) return;
      setItems(extractItemsRef.current(data));
      setPage(data.pagination.page);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (loadError) {
      if (isStale()) return;
      setError(loadError instanceof Error ? loadError.message : loadErrorMessage);
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, [endpoint, pageSize, loadErrorMessage, stableExtraParams]);

  useEffect(() => {
    if (status !== "authenticated" || !session || !canAccessRef.current(session.user)) {
      return;
    }
    void loadItems(page, searchQuery, sortBy, sortDir);
  }, [status, session, page, searchQuery, sortBy, sortDir, loadItems]);

  const handleSubmitSearch = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

  const handleTableSort = useCallback((field: TSortField) => {
    setPage(1);
    handleSortChange(field);
  }, [handleSortChange]);

  const reload = useCallback(
    () => loadItems(page, searchQuery, sortBy, sortDir),
    [loadItems, page, searchQuery, sortBy, sortDir],
  );

  return {
    session,
    status,
    items,
    page,
    setPage,
    total,
    totalPages,
    isLoading,
    error,
    setError,
    searchInput,
    setSearchInput,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDir,
    handleSubmitSearch,
    handleTableSort,
    reload,
  };
}

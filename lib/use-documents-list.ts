"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { useTableSorting } from "@/lib/use-table-sorting";
import {
  DOCUMENT_PAGE_SIZE,
  type DirectoryFilter,
  type DocumentSortField,
  type DocumentSortDirection,
} from "@/lib/document-utils";
import type { DocumentItem, DocumentDirectoryItem } from "@/types";

type DocumentsResponse = {
  documents: DocumentItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  uploadConstraints?: {
    maxUploadMb: number;
  };
};

type DocumentDirectoriesResponse = {
  rootCount: number;
  directories: DocumentDirectoryItem[];
};

const EMPTY_QUERY_PARAMS: Record<string, string | undefined> = {};

interface UseDocumentsListOptions {
  documentsApiPrefix: string;
  directoriesApiPrefix: string;
  accessCheck: (user: { role: string }) => boolean;
  defaultSortField?: DocumentSortField;
  defaultSortDir?: DocumentSortDirection;
  documentsQueryParams?: Record<string, string | undefined>;
  directoriesQueryParams?: Record<string, string | undefined>;
}

interface UseDocumentsListReturn {
  // Auth state
  status: "loading" | "authenticated" | "unauthenticated";
  currentUser?: { role: string };
  isLoading: boolean;
  error: string | null;

  // Documents state
  documents: DocumentItem[];
  total: number;
  page: number;
  totalPages: number;

  // Directories state
  directories: DocumentDirectoryItem[];
  selectedDirectory: DirectoryFilter;
  rootCount: number;

  // Search state
  searchInput: string;
  searchQuery: string;

  // Sorting state
  sortBy: DocumentSortField;
  sortDir: DocumentSortDirection;
  handleSortChange: (field: DocumentSortField) => void;

  // Upload constraints
  maxUploadMb: number;

  // Actions
  setSearchInput: (value: string) => void;
  handleSubmitSearch: (event: React.FormEvent<HTMLFormElement>) => void;
  clearSearch: () => void;
  setSelectedDirectory: (directory: DirectoryFilter) => void;
  setPage: (page: number) => void;
  navigateToRoot: () => void;
  navigateToDirectory: (directoryId: string) => void;
  reload: () => Promise<void>;
  reloadDirectories: () => Promise<void>;
}

export function useDocumentsList({
  documentsApiPrefix,
  directoriesApiPrefix,
  accessCheck,
  defaultSortField = "displayName",
  defaultSortDir = "asc",
  documentsQueryParams,
  directoriesQueryParams,
}: UseDocumentsListOptions): UseDocumentsListReturn {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [directories, setDirectories] = useState<DocumentDirectoryItem[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryFilter>("root");
  const [rootCount, setRootCount] = useState(0);
  const resolvedDocumentsQueryParams = documentsQueryParams ?? EMPTY_QUERY_PARAMS;
  const resolvedDirectoriesQueryParams = directoriesQueryParams ?? EMPTY_QUERY_PARAMS;

  const [maxUploadMb, setMaxUploadMb] = useState(15);

  const { sortBy, sortDir, handleSortChange } = useTableSorting<DocumentSortField>(
    defaultSortField,
    defaultSortDir,
    {
      displayName: "asc",
      updatedAt: "desc",
      documentDate: "desc",
    }
  );

  // Auth redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && session && !accessCheck(session.user)) {
      router.push("/");
    }
  }, [status, session, router, accessCheck]);

  const appendQueryParams = useCallback((url: string, params: Record<string, string | undefined>) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.length > 0) {
        searchParams.set(key, value);
      }
    }
    const queryString = searchParams.toString();
    if (!queryString) {
      return url;
    }
    return `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
  }, []);

  const loadDirectories = useCallback(async () => {
    try {
      const response = await fetch(appendQueryParams(directoriesApiPrefix, resolvedDirectoriesQueryParams));
      const data = (await response.json()) as DocumentDirectoriesResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Verzeichnisse konnten nicht geladen werden");
      }

      const payload = data as DocumentDirectoriesResponse;
      setDirectories(payload.directories);
      setRootCount(payload.rootCount);
    } catch (directoryLoadError: unknown) {
      setDirectories([]);
      setRootCount(0);
      setError(directoryLoadError instanceof Error ? directoryLoadError.message : "Verzeichnisse konnten nicht geladen werden");
    }
  }, [appendQueryParams, directoriesApiPrefix, resolvedDirectoriesQueryParams]);

  const loadDocuments = useCallback(
    async (
      targetPage: number,
      query: string,
      directory: DirectoryFilter,
      nextSortBy: DocumentSortField,
      nextSortDir: DocumentSortDirection,
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(DOCUMENT_PAGE_SIZE),
          sortBy: nextSortBy,
          sortDir: nextSortDir,
        });

        if (query.trim().length > 0) {
          params.set("q", query.trim());
        }

        params.set("directory", directory);
        for (const [key, value] of Object.entries(resolvedDocumentsQueryParams)) {
          if (typeof value === "string" && value.length > 0) {
            params.set(key, value);
          }
        }

        const response = await fetch(`${documentsApiPrefix}?${params.toString()}`);
        const data = (await response.json()) as DocumentsResponse | { error?: string };

        if (!response.ok) {
          const errorMessage =
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Dokumente konnten nicht geladen werden";
          throw new Error(errorMessage);
        }

        const payload = data as DocumentsResponse;
        setDocuments(payload.documents);
        setTotal(payload.pagination.total);
        setPage(payload.pagination.page);
        setTotalPages(payload.pagination.pages);
        if (payload.uploadConstraints?.maxUploadMb && payload.uploadConstraints.maxUploadMb > 0) {
          setMaxUploadMb(payload.uploadConstraints.maxUploadMb);
        }
      } catch (loadError: unknown) {
        setDocuments([]);
        setTotal(0);
        setTotalPages(0);
        setError(loadError instanceof Error ? loadError.message : "Dokumente konnten nicht geladen werden");
      } finally {
        setIsLoading(false);
      }
    },
    [documentsApiPrefix, resolvedDocumentsQueryParams],
  );

  // Load data when dependencies change
  useEffect(() => {
    if (status !== "authenticated" || !session || !accessCheck(session.user)) {
      return;
    }

    void loadDirectories();
    void loadDocuments(page, searchQuery, selectedDirectory, sortBy, sortDir);
  }, [status, session, page, searchQuery, selectedDirectory, sortBy, sortDir, loadDirectories, loadDocuments, accessCheck]);

  const handleSubmitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  const navigateToRoot = () => {
    setSelectedDirectory("root");
    setPage(1);
  };

  const navigateToDirectory = (directoryId: string) => {
    setSelectedDirectory(directoryId);
    setPage(1);
  };

  const reload = useCallback(async () => {
    await Promise.all([
      loadDirectories(),
      loadDocuments(page, searchQuery, selectedDirectory, sortBy, sortDir),
    ]);
  }, [loadDirectories, loadDocuments, page, searchQuery, selectedDirectory, sortBy, sortDir]);

  const reloadDirectories = useCallback(async () => {
    await loadDirectories();
  }, [loadDirectories]);

  return {
    status,
    currentUser: session?.user as { role: string } | undefined,
    isLoading,
    error,
    documents,
    total,
    page,
    totalPages,
    directories,
    selectedDirectory,
    rootCount,
    searchInput,
    searchQuery,
    sortBy,
    sortDir,
    handleSortChange,
    maxUploadMb,
    setSearchInput,
    handleSubmitSearch,
    clearSearch,
    setSelectedDirectory,
    setPage,
    navigateToRoot,
    navigateToDirectory,
    reload,
    reloadDirectories,
  };
}

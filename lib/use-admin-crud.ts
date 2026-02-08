import { useCallback, useRef } from "react";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";

export function useAdminCrud() {
  const createFetchHandler = useCallback(<T,>(
    url: string,
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    setError: (val: string) => void,
    setIsLoading: (val: boolean) => void,
    data?: T
  ) => {
    return async (id?: string): Promise<{ success: boolean; data?: unknown }> => {
      setError("");
      setIsLoading(true);

      try {
        const fetchUrl = id ? `${url}/${id}` : url;
        const response = await fetch(fetchUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          ...(data && { body: JSON.stringify(data) }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          setError(responseData.error || "Ein Fehler ist aufgetreten");
          return { success: false };
        }

        return { success: true, data: responseData };
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    };
  }, []);

  const createDeleteHandler = useCallback((
    fetchHandler: (id?: string) => Promise<{ success: boolean }>,
    setSuccess: (val: string) => void,
    successMessage: string,
    refresh: () => void
  ) => {
    return async (id: string): Promise<void> => {
      if (!confirm("Möchten Sie dies wirklich löschen?")) {
        return;
      }

      const result = await fetchHandler(id);
      if (result.success) {
        setSuccess(successMessage);
        await refresh();
      }
    };
  }, []);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createFetchDataHandler = useCallback(<T,>(
    url: string,
    setData: (val: T) => void,
    setError: (val: string) => void,
    setIsLoading: (val: boolean) => void,
    router?: { push: (path: string) => void },
    dataKey?: string
  ) => {
    return async () => {
      setError("");
      const currentRequestId = ++requestIdRef.current;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const isRequestStale = () => currentRequestId !== requestIdRef.current;

      try {
        const response = await fetch(url, {
          signal: abortController.signal,
        });

        if (isRequestStale()) {
          return;
        }

        if (!response.ok) {
          if (router && (response.status === 401 || response.status === 403)) {
            router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
            return;
          }
          throw new Error("Fehler beim Laden der Daten");
        }

        const responseData = await response.json();

        if (isRequestStale()) {
          return;
        }

        setData(dataKey ? responseData[dataKey] : responseData);
      } catch (err: unknown) {
        if (isRequestStale()) {
          return;
        }

        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
      } finally {
        if (!isRequestStale()) {
          setIsLoading(false);
        }
      }
    };
  }, []);

  const createPublishHandler = useCallback((
    setSuccess: (val: string) => void,
    setError: (val: string) => void,
    refresh: () => void
  ) => {
    return async (
      url: string,
      body: Record<string, boolean>,
      messages: { success: string; error: string }
    ): Promise<void> => {
      setError("");
      try {
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || messages.error);
        }

        setSuccess(messages.success);
        await refresh();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
        setError(errorMessage);
      }
    };
  }, []);

  return { createFetchHandler, createDeleteHandler, createFetchDataHandler, createPublishHandler };
}

import { useCallback, useRef } from "react";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { FieldError } from "@/lib/server-error-mapper";

interface CrudResult {
  success: boolean;
  data?: unknown;
  fieldErrors?: FieldError[];
}

const GENERIC_ERROR_MESSAGE = "Ein Fehler ist aufgetreten";
const NETWORK_ERROR_MESSAGE =
  "Netzwerkfehler: Der Server ist nicht erreichbar. Bitte versuchen Sie es erneut.";

// 204- oder Nicht-JSON-Antworten dürfen keinen "Unexpected end of JSON input"-Fehler auslösen
async function parseJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// fetch wirft bei Netzwerkfehlern TypeError mit englischer Browser-Meldung ("Failed to fetch")
function toDisplayErrorMessage(err: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (err instanceof TypeError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (err instanceof SyntaxError) {
    return fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useAdminCrud() {
  const confirm = useConfirmDialog();

  const createFetchHandler = useCallback(<T,>(
    url: string,
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    setError: (val: string) => void,
    setIsLoading: (val: boolean) => void,
    data?: T
  ) => {
    return async (id?: string): Promise<CrudResult> => {
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

        const responseData = await parseJsonBody(response);

        if (!response.ok) {
          setError(
            (typeof responseData.error === "string" && responseData.error) || GENERIC_ERROR_MESSAGE
          );
          return { success: false, fieldErrors: responseData.fieldErrors as FieldError[] | undefined };
        }

        return { success: true, data: responseData };
      } catch (err: unknown) {
        setError(toDisplayErrorMessage(err));
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
      if (!await confirm({
        message: "Möchten Sie dies wirklich löschen?",
        confirmLabel: "Löschen",
        variant: "danger",
      })) {
        return;
      }

      const result = await fetchHandler(id);
      if (result.success) {
        setSuccess(successMessage);
        await refresh();
      }
    };
  }, [confirm]);

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

        setError(toDisplayErrorMessage(err, "Fehler beim Laden der Daten"));
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
          const data = await parseJsonBody(response);
          throw new Error((typeof data.error === "string" && data.error) || messages.error);
        }

        setSuccess(messages.success);
        await refresh();
      } catch (err: unknown) {
        setError(toDisplayErrorMessage(err));
      }
    };
  }, []);

  return { createFetchHandler, createDeleteHandler, createFetchDataHandler, createPublishHandler };
}

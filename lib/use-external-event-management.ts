import { useState, useCallback, useEffect } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import {
  EXTERNAL_EVENT_DELETED_MESSAGE,
  EXTERNAL_EVENT_SAVED_MESSAGE,
  useExternalEventForm,
} from "./use-external-event-form";
import { canAccessAdminArea } from "@/lib/role-utils";
import { API_ROUTES } from "@/lib/api-routes";
import { apiFetch, toDisplayErrorMessage } from "@/lib/api-fetch";
import type { ExternalEventItem } from "@/types";

const ENDPOINT = API_ROUTES.ADMIN.EXTERNAL_EVENTS;

export function useExternalEventManagement() {
  const { session, status } = useAdminAuth();
  const { createFetchHandler, createDeleteHandler } = useAdminCrud();

  const [externalEvents, setExternalEvents] = useState<ExternalEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useSuccessTimer(success, setSuccess);

  const fetchExternalEvents = useCallback(async () => {
    setError("");
    try {
      const data = await apiFetch<{ externalEvents: ExternalEventItem[] }>(ENDPOINT, {
        fallbackError: "Fehler beim Laden der Fremdtermine",
      });
      setExternalEvents(data.externalEvents ?? []);
    } catch (err: unknown) {
      setError(toDisplayErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && canAccessAdminArea(session?.user)) {
      void fetchExternalEvents();
    }
  }, [status, session, fetchExternalEvents]);

  const handleSaved = useCallback(async () => {
    setSuccess(EXTERNAL_EVENT_SAVED_MESSAGE);
    await fetchExternalEvents();
  }, [fetchExternalEvents]);

  const form = useExternalEventForm(handleSaved);

  const deleteExternalEvent = createFetchHandler(ENDPOINT, "DELETE", setError, setIsDeleting);
  const handleDelete = createDeleteHandler(
    deleteExternalEvent,
    setSuccess,
    EXTERNAL_EVENT_DELETED_MESSAGE,
    () => fetchExternalEvents()
  );

  return {
    externalEvents,
    isLoading,
    isDeleting,
    error,
    success,
    handleDelete,
    form,
  };
}

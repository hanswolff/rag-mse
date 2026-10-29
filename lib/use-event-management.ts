import { useState, useCallback, useEffect, useRef } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useAdminEntityManagement } from "./use-admin-entity-management";
import { formatLocalDateForInput } from "@/lib/dates";
import { canAccessAdminArea } from "@/lib/role-utils";
import { EMPTY_EVENT_FORM } from "@/lib/event-form-defaults";
import { Visibility } from "@/lib/visibility";
import type { Event, NewEvent, Pagination } from "@/types";

const PUBLISH_MESSAGES = {
  event: {
    published: "Termin wurde veröffentlicht",
    error: "Fehler beim Veröffentlichen",
  },
} as const;

const EVENTS_PER_PAGE = 10;

interface EventsResponse {
  events: Event[];
  pagination?: Pagination;
}

export function eventToFormData(event: Event): NewEvent {
  return {
    date: formatLocalDateForInput(event.date),
    timeFrom: event.timeFrom,
    timeTo: event.timeTo,
    location: event.location,
    title: event.title || "",
    description: event.description,
    latitude: event.latitude?.toString() || "",
    longitude: event.longitude?.toString() || "",
    type: event.type || "",
    cost: event.cost || "",
    capacity: event.capacity?.toString() || "",
    visibility: event.visibility,
  };
}

interface UseEventManagementOptions {
  enforceAdminRedirect?: boolean;
  enabled?: boolean;
}

export function useEventManagement(options: UseEventManagementOptions = {}) {
  const { enforceAdminRedirect = true, enabled = true } = options;
  const { session, status } = useAdminAuth({ redirectOnFailure: enforceAdminRedirect });
  const { createPublishHandler } = useAdminCrud();

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLoadingLatestDescription, setIsLoadingLatestDescription] = useState(false);
  const [publishingEventId, setPublishingEventId] = useState<string | null>(null);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);

  // refetch wird an den generischen Hook übergeben, bevor fetchEvents existiert
  // (fetchEvents braucht dessen setError) — daher spät gebunden über eine Ref.
  const fetchEventsRef = useRef<(page: number) => Promise<void> | void>(() => {});
  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const management = useAdminEntityManagement<Event, NewEvent>({
    endpoint: "/api/admin/events",
    emptyForm: EMPTY_EVENT_FORM,
    itemToForm: eventToFormData,
    messages: {
      created: "Termin wurde erfolgreich erstellt",
      updated: "Termin wurde erfolgreich aktualisiert",
      deleted: "Termin wurde erfolgreich gelöscht",
    },
    refetch: () => fetchEventsRef.current(currentPageRef.current),
    refetchAfterCreate: async () => {
      if (currentPageRef.current === 1) {
        await fetchEventsRef.current(1);
      } else {
        setCurrentPage(1);
      }
    },
  });

  const {
    setError,
    setSuccess,
    setModalData,
    modalData,
    closeModal: baseCloseModal,
  } = management;

  // Stale-Response-Guard: Bei schneller Paginierung darf nur die zuletzt
  // angeforderte Seite den State setzen
  const fetchEventsRequestIdRef = useRef(0);

  const fetchEvents = useCallback(async (page: number) => {
    setError("");
    setIsLoading(true);

    const requestId = ++fetchEventsRequestIdRef.current;
    const isStale = () => requestId !== fetchEventsRequestIdRef.current;

    const requestedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

    try {
      let targetPage = requestedPage;
      let response = await fetch(`/api/admin/events?page=${targetPage}&limit=${EVENTS_PER_PAGE}`);

      if (!response.ok) {
        throw new Error("Fehler beim Laden der Daten");
      }

      let data: EventsResponse = await response.json();
      const pages = data.pagination?.pages ?? 0;

      if (pages > 0 && targetPage > pages) {
        targetPage = pages;
        response = await fetch(`/api/admin/events?page=${targetPage}&limit=${EVENTS_PER_PAGE}`);

        if (!response.ok) {
          throw new Error("Fehler beim Laden der Daten");
        }

        data = await response.json();
      }

      if (isStale()) return;

      setEvents(data.events ?? []);
      setTotalEvents(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.pages ?? 0);
      setCurrentPage(targetPage);
    } catch (err: unknown) {
      if (isStale()) return;
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [setError]);

  useEffect(() => {
    fetchEventsRef.current = fetchEvents;
  }, [fetchEvents]);

  useEffect(() => {
    if (enabled && status === "authenticated" && canAccessAdminArea(session?.user)) {
      void fetchEvents(currentPage);
    }
  }, [enabled, status, session, currentPage, fetchEvents]);

  const closeModal = useCallback(() => {
    setGeocodeSuccess(false);
    baseCloseModal();
  }, [baseCloseModal]);

  const handleGeocode = useCallback(async () => {
    if (!modalData.location || modalData.location.trim().length < 3) {
      setError("Bitte geben Sie eine Adresse mit mindestens 3 Zeichen ein");
      return;
    }

    setIsGeocoding(true);
    setGeocodeSuccess(false);
    setError("");

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(modalData.location)}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Geocoding");
      }

      setModalData({
        ...modalData,
        latitude: data.latitude.toString(),
        longitude: data.longitude.toString(),
      });
      setGeocodeSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      setError(errorMessage);
    } finally {
      setIsGeocoding(false);
    }
  }, [modalData, setError, setModalData]);

  const handleUseLatestDescription = useCallback(async () => {
    setError("");
    setIsLoadingLatestDescription(true);

    try {
      const response = await fetch("/api/admin/events?page=1&limit=1", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Laden des letzten Termins");
      }

      const latestEvent = data?.events?.[0] as Event | undefined;

      if (!latestEvent) {
        setError("Kein letzter Termin gefunden");
        return;
      }

      setModalData(eventToFormData(latestEvent));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoadingLatestDescription(false);
    }
  }, [setError, setModalData]);

  const handlePublishEvent = useCallback(async (eventId: string) => {
    const publish = createPublishHandler(setSuccess, setError, () => fetchEvents(currentPage));
    setPublishingEventId(eventId);
    try {
      await publish(
        `/api/admin/events/${eventId}`,
        { visibility: Visibility.PUBLIC },
        {
          success: PUBLISH_MESSAGES.event.published,
          error: PUBLISH_MESSAGES.event.error,
        }
      );
    } finally {
      setPublishingEventId(null);
    }
  }, [createPublishHandler, currentPage, fetchEvents, setError, setSuccess]);

  const handlePageChange = useCallback((page: number) => {
    const maxPage = totalPages > 0 ? totalPages : 1;
    if (page < 1 || page > maxPage || page === currentPage) {
      return;
    }
    setCurrentPage(page);
  }, [currentPage, totalPages]);

  return {
    events,
    currentPage,
    totalPages,
    totalEvents,
    eventsPerPage: EVENTS_PER_PAGE,
    isLoading,
    isCreatingEvent: management.isCreating,
    isEditingEvent: management.isUpdating,
    isDeletingEvent: management.isDeleting,
    publishingEventId,
    isGeocoding,
    isLoadingLatestDescription,
    geocodeSuccess,
    error: management.error,
    fieldErrors: management.fieldErrors,
    success: management.success,
    editingEvent: management.editingItem,
    modalEventData: management.modalData,
    setModalEventData: management.setModalData,
    initialEventData: management.initialData,
    isModalOpen: management.isModalOpen,
    handleCreateEvent: management.handleCreate,
    handleUpdateEvent: management.handleUpdate,
    handleDeleteEvent: management.handleDelete,
    startEditingEvent: management.startEditing,
    cancelEditingEvent: closeModal,
    handleGeocode,
    handleUseLatestDescription,
    handlePublishEvent,
    handlePageChange,
    openCreateModal: management.openCreateModal,
    closeModal,
  };
}

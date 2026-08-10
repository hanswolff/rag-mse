import { useState, useCallback, useEffect, useRef } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import { parseISODate, formatDateForStorage } from "@/lib/date-picker-utils";
import { isAdmin } from "@/lib/role-utils";
import { EMPTY_EVENT_FORM } from "@/lib/event-form-defaults";
import type { Event, NewEvent } from "@/types";
import type { FieldError } from "@/lib/server-error-mapper";

const PUBLISH_MESSAGES = {
  event: {
    published: "Termin wurde veröffentlicht",
    unpublished: "Termin wurde versteckt",
    error: "Fehler beim Veröffentlichen",
  },
} as const;

const EVENTS_PER_PAGE = 10;

interface EventsResponse {
  events: Event[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

function formatDateForInput(value: string): string {
  const date = parseISODate(value);
  if (!date) {
    return value;
  }
  return formatDateForStorage(date);
}

export function eventToFormData(event: Event): NewEvent {
  return {
    date: formatDateForInput(event.date),
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
    visible: event.visible ?? true,
  };
}

interface UseEventManagementOptions {
  enforceAdminRedirect?: boolean;
  enabled?: boolean;
}

export function useEventManagement(options: UseEventManagementOptions = {}) {
  const { enforceAdminRedirect = true, enabled = true } = options;
  const { session, status } = useAdminAuth({ redirectOnFailure: enforceAdminRedirect });
  const { createFetchHandler, createDeleteHandler, createPublishHandler } = useAdminCrud();

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLoadingLatestDescription, setIsLoadingLatestDescription] = useState(false);
  const [publishingEventId, setPublishingEventId] = useState<string | null>(null);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [success, setSuccess] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEventData, setModalEventData] = useState<NewEvent>(EMPTY_EVENT_FORM);
  const [initialEventData, setInitialEventData] = useState<NewEvent | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);

  useSuccessTimer(success, setSuccess);

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
  }, []);

  useEffect(() => {
    if (enabled && status === "authenticated" && isAdmin(session?.user)) {
      void fetchEvents(currentPage);
    }
  }, [enabled, status, session, currentPage, fetchEvents]);

  const createEvent = createFetchHandler<NewEvent>(
    "/api/admin/events",
    "POST",
    setError,
    setIsCreatingEvent,
    modalEventData
  );

  const updateEvent = createFetchHandler<NewEvent>(
    "/api/admin/events",
    "PUT",
    setError,
    setIsEditingEvent,
    modalEventData
  );

  const deleteEvent = createFetchHandler(
    "/api/admin/events",
    "DELETE",
    setError,
    setIsDeletingEvent
  );

  const handleCreateEvent = useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    setFieldErrors([]);
    const result = await createEvent();
    if (result.success) {
      setSuccess("Termin wurde erfolgreich erstellt");
      setIsModalOpen(false);
      setModalEventData(EMPTY_EVENT_FORM);
      setEditingEvent(null);
      if (currentPage === 1) {
        await fetchEvents(1);
      } else {
        setCurrentPage(1);
      }
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
  }, [createEvent, currentPage, fetchEvents]);

  const handleUpdateEvent = useCallback(async (e: React.FormEvent) => {
    if (!editingEvent) return;
    if (e) e.preventDefault();

    setFieldErrors([]);
    const result = await updateEvent(editingEvent.id);
    if (result.success) {
      setSuccess("Termin wurde erfolgreich aktualisiert");
      setIsModalOpen(false);
      setModalEventData(EMPTY_EVENT_FORM);
      setEditingEvent(null);
      await fetchEvents(currentPage);
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
  }, [currentPage, editingEvent, updateEvent, fetchEvents]);

  const handleDeleteEvent = createDeleteHandler(
    deleteEvent,
    setSuccess,
    "Termin wurde erfolgreich gelöscht",
    // eslint-disable-next-line react-hooks/refs -- refresh only runs inside the click-triggered delete handler, never during render
    () => fetchEvents(currentPage)
  );

  const startEditingEvent = useCallback((event: Event) => {
    setEditingEvent(event);
    const eventData = eventToFormData(event);
    setModalEventData(eventData);
    setInitialEventData(eventData);
    setError("");
    setFieldErrors([]);
    setIsModalOpen(true);
  }, []);

  const openCreateModal = useCallback(() => {
    setModalEventData(EMPTY_EVENT_FORM);
    setEditingEvent(null);
    setInitialEventData(undefined);
    setError("");
    setFieldErrors([]);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalEventData(EMPTY_EVENT_FORM);
    setInitialEventData(undefined);
    setEditingEvent(null);
    setGeocodeSuccess(false);
    setError("");
    setFieldErrors([]);
  }, []);

  const cancelEditingEvent = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const handleGeocode = useCallback(async () => {
    if (!modalEventData.location || modalEventData.location.trim().length < 3) {
      setError("Bitte geben Sie eine Adresse mit mindestens 3 Zeichen ein");
      return;
    }

    setIsGeocoding(true);
    setGeocodeSuccess(false);
    setError("");

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(modalEventData.location)}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Geocoding");
      }

      setModalEventData({
        ...modalEventData,
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
  }, [modalEventData]);

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

      setModalEventData(eventToFormData(latestEvent));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoadingLatestDescription(false);
    }
  }, []);

  const handlePublishEvent = useCallback(async (eventId: string, published: boolean) => {
    const publish = createPublishHandler(setSuccess, setError, () => fetchEvents(currentPage));
    setPublishingEventId(eventId);
    try {
      await publish(
        `/api/admin/events/${eventId}`,
        { visible: published },
        {
          success: published ? PUBLISH_MESSAGES.event.published : PUBLISH_MESSAGES.event.unpublished,
          error: PUBLISH_MESSAGES.event.error,
        }
      );
    } finally {
      setPublishingEventId(null);
    }
  }, [createPublishHandler, currentPage, fetchEvents]);

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
    isCreatingEvent,
    isEditingEvent,
    isDeletingEvent,
    publishingEventId,
    isGeocoding,
    isLoadingLatestDescription,
    geocodeSuccess,
    error,
    fieldErrors,
    success,
    editingEvent,
    modalEventData,
    setModalEventData,
    initialEventData,
    isModalOpen,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    startEditingEvent,
    cancelEditingEvent,
    handleGeocode,
    handleUseLatestDescription,
    handlePublishEvent,
    handlePageChange,
    openCreateModal,
    closeModal,
  };
}

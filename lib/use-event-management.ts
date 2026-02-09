import { useState, useCallback, useEffect } from "react";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import { parseISODate, formatDateForStorage } from "@/lib/date-picker-utils";
import { isAdmin } from "@/lib/role-utils";
import type { Event, NewEvent } from "@/types";

const PUBLISH_MESSAGES = {
  event: {
    published: "Termin wurde veröffentlicht",
    unpublished: "Termin wurde versteckt",
    error: "Fehler beim Veröffentlichen",
  },
} as const;

const initialNewEvent: NewEvent = {
  date: "",
  timeFrom: "",
  timeTo: "",
  location: "",
  description: "",
  latitude: "",
  longitude: "",
  type: "",
  visible: true,
};

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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [publishingEventId, setPublishingEventId] = useState<string | null>(null);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEventData, setModalEventData] = useState<NewEvent>(initialNewEvent);
  const [initialEventData, setInitialEventData] = useState<NewEvent | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);

  useSuccessTimer(success, setSuccess);

  const fetchEvents = useCallback(async (page: number) => {
    setError("");
    setIsLoading(true);

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

      setEvents(data.events ?? []);
      setTotalEvents(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.pages ?? 0);
      setCurrentPage(targetPage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
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
    setIsCreatingEvent
  );

  const handleCreateEvent = useCallback(async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    const result = await createEvent();
    if (result.success) {
      setSuccess("Termin wurde erfolgreich erstellt");
      setIsModalOpen(false);
      setModalEventData(initialNewEvent);
      setEditingEvent(null);
      if (currentPage === 1) {
        await fetchEvents(1);
      } else {
        setCurrentPage(1);
      }
    }
  }, [createEvent, currentPage, fetchEvents]);

  const handleUpdateEvent = useCallback(async (e: React.FormEvent) => {
    if (!editingEvent) return;
    if (e) e.preventDefault();

    const result = await updateEvent(editingEvent.id);
    if (result.success) {
      setSuccess("Termin wurde erfolgreich aktualisiert");
      setIsModalOpen(false);
      setModalEventData(initialNewEvent);
      setEditingEvent(null);
      await fetchEvents(currentPage);
    }
  }, [currentPage, editingEvent, updateEvent, fetchEvents]);

  const handleDeleteEvent = createDeleteHandler(
    deleteEvent,
    setSuccess,
    "Termin wurde erfolgreich gelöscht",
    () => fetchEvents(currentPage)
  );

  const startEditingEvent = useCallback((event: Event) => {
    setEditingEvent(event);
    const dateStr = formatDateForInput(event.date);
    const eventData = {
      date: dateStr,
      timeFrom: event.timeFrom,
      timeTo: event.timeTo,
      location: event.location,
      description: event.description,
      latitude: event.latitude?.toString() || "",
      longitude: event.longitude?.toString() || "",
      type: event.type || "",
      visible: event.visible ?? true,
    };
    setModalEventData(eventData);
    setInitialEventData(eventData);
    setError("");
    setIsModalOpen(true);
  }, []);

  const openCreateModal = useCallback(() => {
    setModalEventData(initialNewEvent);
    setEditingEvent(null);
    setInitialEventData(undefined);
    setError("");
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalEventData(initialNewEvent);
    setInitialEventData(undefined);
    setEditingEvent(null);
    setGeocodeSuccess(false);
    setError("");
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
    publishingEventId,
    isGeocoding,
    geocodeSuccess,
    error,
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
    handlePublishEvent,
    handlePageChange,
    openCreateModal,
    closeModal,
  };
}

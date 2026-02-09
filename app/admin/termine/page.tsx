"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { useEventManagement } from "@/lib/use-event-management";
import { formatDate, formatTime } from "@/lib/date-utils";
import { getEventDescriptionPreview } from "@/lib/event-description";
import { EventFormModal } from "@/components/event-form-modal";
import { LoadingButton } from "@/components/loading-button";
import { BackLink } from "@/components/back-link";
import { Pagination } from "@/components/pagination";
import type { Event } from "@/types";

function EventList({
  events,
  onEdit,
  onDelete,
  onPublish,
  publishingEventId,
}: {
  events: Event[];
  onEdit: (e: Event) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string, published: boolean) => void;
  publishingEventId: string | null;
}) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-500 mb-4">Noch keine Termine vorhanden</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div key={event.id} className="border border-gray-200 rounded-md p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-medium text-gray-900">{event.location}</h3>
                {event.type && (
                  <span className={`px-2 py-0.5 text-base font-medium rounded ${
                    event.type === "Training"
                      ? "bg-brand-blue-50 text-brand-blue-800"
                      : "bg-orange-100 text-orange-800"
                  }`}>
                    {event.type}
                  </span>
                )}
                {!event.visible && (
                  <span className="px-2 py-0.5 text-base font-medium rounded bg-amber-100 text-amber-800">
                    Nicht sichtbar
                  </span>
                )}
              </div>
              <p className="text-base text-gray-600 mt-1">
                {formatDate(event.date)} {formatTime(event.timeFrom)} - {formatTime(event.timeTo)}
              </p>
              <p className="text-base text-gray-500 mt-1">{getEventDescriptionPreview(event.description, 220)}</p>
              <p className="text-base text-gray-400 mt-2">
                Anmeldungen: {event._count?.votes || 0}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-4">
              <button
                onClick={() => onEdit(event)}
                className="px-3 py-2 sm:py-1 text-base bg-brand-blue-50 text-brand-blue-800 rounded hover:bg-brand-blue-100 focus:outline-none focus:ring-2 focus:ring-brand-red-600/30 touch-manipulation"
              >
                Bearbeiten
              </button>
              {!event.visible && (
                <LoadingButton
                  onClick={() => onPublish(event.id, true)}
                  loading={publishingEventId === event.id}
                  loadingText="Veröffentlichen"
                  className="px-3 py-2 sm:py-1 text-base bg-green-100 text-green-700 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 touch-manipulation disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Veröffentlichen
                </LoadingButton>
              )}
              <button
                onClick={() => onDelete(event.id)}
                className="px-3 py-2 sm:py-1 text-base bg-red-100 text-red-700 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 touch-manipulation"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TerminePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const eventManagement = useEventManagement();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading" || eventManagement.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Termine verwalten</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Erstellen, bearbeiten und verwalten Sie Trainingstermine und Wettkämpfe</p>
        </div>

        {eventManagement.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {eventManagement.error}
          </div>
        )}

        {eventManagement.success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {eventManagement.success}
          </div>
        )}

        <section className="card-compact">
          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={eventManagement.openCreateModal}
              className="btn-primary py-2.5 sm:py-2 px-6 text-base sm:text-base touch-manipulation sm:w-auto"
            >
              Neuen Termin erstellen
            </button>
            <p className="text-base text-gray-600">
              {eventManagement.totalEvents} Termine gesamt
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Terminliste</h2>
          </div>
          <EventList
            events={eventManagement.events}
            onEdit={eventManagement.startEditingEvent}
            onDelete={eventManagement.handleDeleteEvent}
            onPublish={eventManagement.handlePublishEvent}
            publishingEventId={eventManagement.publishingEventId}
          />
          <Pagination
            currentPage={eventManagement.currentPage}
            totalPages={eventManagement.totalPages}
            onPageChange={eventManagement.handlePageChange}
          />
        </section>

        <EventFormModal
          isOpen={eventManagement.isModalOpen}
          onClose={eventManagement.closeModal}
          onSubmit={eventManagement.editingEvent ? eventManagement.handleUpdateEvent : eventManagement.handleCreateEvent}
          isSubmitting={eventManagement.isCreatingEvent || eventManagement.isEditingEvent}
          eventData={eventManagement.modalEventData}
          setEventData={eventManagement.setModalEventData}
          isEditing={!!eventManagement.editingEvent}
          errors={eventManagement.error ? { general: eventManagement.error } : {}}
          initialEventData={eventManagement.initialEventData}
          isGeocoding={eventManagement.isGeocoding}
          onGeocode={eventManagement.handleGeocode}
          geocodeSuccess={eventManagement.geocodeSuccess}
        />
      </div>
    </main>
  );
}

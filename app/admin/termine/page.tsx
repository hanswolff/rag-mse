"use client";

import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { useEventManagement } from "@/lib/use-event-management";
import { formatDate, formatTime } from "@/lib/date-utils";
import { getEventDescriptionPreview } from "@/lib/event-description";
import { pluralize } from "@/lib/pluralization";
import { formatOccupancy, formatRegistrationCount, isOverbooked } from "@/lib/registration-count";
import { EventTypeBadge } from "@/components/event-type-badge";
import { EventFormModal } from "@/components/event-form-modal";
import { LoadingButton } from "@/components/loading-button";
import { LoadingScreen } from "@/components/loading-screen";
import { BackLink } from "@/components/back-link";
import { Pagination } from "@/components/pagination";
import { CalendarIcon } from "@/components/icons";
import type { Event } from "@/types";
import { AlertBox } from "@/components/alert-box";

function EventList({
  events,
  onEdit,
  onDelete,
  onPublish,
  publishingEventId,
  canManage,
}: {
  events: Event[];
  onEdit: (e: Event) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string, published: boolean) => void;
  publishingEventId: string | null;
  canManage: boolean;
}) {
  // Ohne voteCounts steht nur die Gesamtzahl der Mitglieder-Anmeldungen zur Verfügung —
  // die taugt nicht als Belegung, weil sie Nein/Vielleicht mitzählt und Gäste auslässt.
  function getOccupancy(event: Event) {
    if (!event.voteCounts || typeof event.capacity !== "number") return null;
    return { voteCounts: event.voteCounts, capacity: event.capacity };
  }

  function getEventRegistrationCountLabel(event: Event): string {
    const occupancy = getOccupancy(event);
    if (occupancy) {
      return formatOccupancy(occupancy.voteCounts, occupancy.capacity);
    }
    return formatRegistrationCount(
      event.voteCounts ?? { JA: event._count?.votes || 0, NEIN: 0, VIELLEICHT: 0 }
    );
  }

  function isEventOverbooked(event: Event): boolean {
    const occupancy = getOccupancy(event);
    return !!occupancy && isOverbooked(occupancy.voteCounts, occupancy.capacity);
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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
                <h3 className="font-medium text-gray-900">{event.locationDisplay || event.location}</h3>
                <EventTypeBadge type={event.type} />
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
                Anmeldungen: {getEventRegistrationCountLabel(event)}
              </p>
              <AlertBox
                type="warning"
                className="mt-2"
                message={
                  isEventOverbooked(event)
                    ? "Überbucht: mehr Ja-Anmeldungen als Plätze. Die Anmeldung bleibt trotzdem offen."
                    : null
                }
              />
            </div>
            {canManage && (
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
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TerminePage() {
  const { data: session, status } = useSession();
  const eventManagement = useEventManagement();
  const canManage = session ? isAdmin(session.user) : false;

  if (status === "loading" || eventManagement.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Termine verwalten</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Erstellen, bearbeiten und verwalten Sie Trainingstermine und Wettkämpfe</p>
          {canManage && (
            <button
              onClick={eventManagement.openCreateModal}
              className="mt-4 btn-primary py-2.5 sm:py-2 px-6 text-base sm:text-base touch-manipulation"
            >
              Neuen Termin erstellen
            </button>
          )}
        </div>

        <AlertBox type="error" message={eventManagement.error} className="mb-4" />

        <AlertBox type="success" message={eventManagement.success} className="mb-4" />

        <section className="card-compact">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Terminliste</h2>
            <p className="text-base text-gray-600">{eventManagement.totalEvents} {pluralize(eventManagement.totalEvents, "Termin", "Termine")} gesamt</p>
          </div>
          <EventList
            events={eventManagement.events}
            onEdit={eventManagement.startEditingEvent}
            onDelete={eventManagement.handleDeleteEvent}
            onPublish={eventManagement.handlePublishEvent}
            publishingEventId={eventManagement.publishingEventId}
            canManage={canManage}
          />
          <Pagination
            currentPage={eventManagement.currentPage}
            totalPages={eventManagement.totalPages}
            onPageChange={eventManagement.handlePageChange}
          />
        </section>

        {canManage && (
          <EventFormModal
            isOpen={eventManagement.isModalOpen}
            onClose={eventManagement.closeModal}
            onSubmit={eventManagement.editingEvent ? eventManagement.handleUpdateEvent : eventManagement.handleCreateEvent}
            isSubmitting={eventManagement.isCreatingEvent || eventManagement.isEditingEvent}
            eventData={eventManagement.modalEventData}
            setEventData={eventManagement.setModalEventData}
            isEditing={!!eventManagement.editingEvent}
            errors={eventManagement.error ? { general: eventManagement.error } : {}}
            fieldErrors={eventManagement.fieldErrors}
            initialEventData={eventManagement.initialEventData}
            isGeocoding={eventManagement.isGeocoding}
            onGeocode={eventManagement.handleGeocode}
            geocodeSuccess={eventManagement.geocodeSuccess}
            onUseLastEvent={eventManagement.handleUseLatestDescription}
            isLoadingLastEvent={eventManagement.isLoadingLatestDescription}
          />
        )}
      </div>
    </main>
  );
}

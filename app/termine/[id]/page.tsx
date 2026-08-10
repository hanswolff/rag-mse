"use client";

import { useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/date-utils";
import { VotingResults } from "@/components/voting-results";
import { EventMap } from "@/components/event-map";
import { EventFormModal } from "@/components/event-form-modal";
import { isAdmin } from "@/lib/role-utils";
import { VOTE_OPTIONS } from "@/lib/vote-utils";
import { BackLink } from "@/components/back-link";
import { ExternalLinkIcon } from "@/components/icons";
import { LoadingButton } from "@/components/loading-button";
import { useEventManagement } from "@/lib/use-event-management";
import { formatEventDescriptionForDisplay } from "@/lib/event-description";
import { Modal } from "@/components/modal";
import { AlertBox } from "@/components/alert-box";
import { useEventDetail } from "@/lib/use-event-detail";
import { useEventVoting } from "@/lib/use-event-voting";
import { serializeJsonLd } from "@/lib/json-ld";
import { EventTypeBadge } from "@/components/event-type-badge";
import { pluralize } from "@/lib/pluralization";
import { formatOccupancy } from "@/lib/registration-count";

function getOpenStreetMapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const isAdminUser = session ? isAdmin(session.user) : false;
  const eventManagement = useEventManagement({ enforceAdminRedirect: false, enabled: isAdminUser });

  const {
    event,
    setEvent,
    isLoading,
    error,
    fetchEvent,
    isPast,
    eventJsonLd,
    loginUrl,
  } = useEventDetail(id);

  const voting = useEventVoting({
    eventId: id,
    event,
    setEvent,
    fetchEvent,
    session: session ?? null,
    isAdminUser,
  });

  const { refreshAdminRegistrations } = voting;

  useEffect(() => {
    if (eventManagement.success && !eventManagement.isModalOpen) {
      fetchEvent(id);
      if (isAdminUser) {
        refreshAdminRegistrations();
      }
    }
  }, [eventManagement.success, eventManagement.isModalOpen, id, isAdminUser, fetchEvent, refreshAdminRegistrations]);

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <BackLink href="/termine" className="inline-flex items-center">
            Zurück zur Termin-Übersicht
          </BackLink>
          {session && isAdmin(session.user) && event && (
            <button
              onClick={() => eventManagement.startEditingEvent(event)}
              className="btn-primary text-base w-full sm:w-auto"
            >
              Bearbeiten
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-gray-600 text-center py-8">Laden...</div>
        ) : error ? (
          <div className="card text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <BackLink href="/termine">
              Zurück zur Termin-Übersicht
            </BackLink>
          </div>
        ) : null}

        <AlertBox type="success" message={eventManagement.success} className="mb-4" />

        {event && (
          <div className="space-y-6">
            {eventJsonLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventJsonLd) }}
              />
            )}
            <article className="card">
              <div className="p-0">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {event.title || formatDate(event.date)}
                    </h1>
                    <EventTypeBadge type={event.type} size="large" />
                  </div>
                  <p className="text-lg text-gray-600">
                    {event.title && `${formatDate(event.date)}, `}
                    {formatTime(event.timeFrom)} - {formatTime(event.timeTo)}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">Ort</h2>
                    {event.latitude !== null && event.longitude !== null && (
                      <a
                        href={getOpenStreetMapUrl(event.latitude, event.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-blue-600 hover:text-brand-blue-800 hover:underline flex items-center gap-1 self-start sm:self-auto"
                      >
                        <ExternalLinkIcon className="h-4 w-4" />
                        Karte in neuem Tab öffnen
                      </a>
                    )}
                  </div>
                  <p className="text-gray-700 mb-4">{event.locationDisplay || event.location}</p>

                  {event.latitude !== null && event.longitude !== null && (
                    <EventMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                      location={event.locationDisplay || event.location}
                    />
                  )}
                </div>

                {event.cost && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Kosten</h2>
                    <p className="text-gray-700">{event.cost}</p>
                  </div>
                )}

                {event.capacity !== null && event.capacity !== undefined && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Plätze</h2>
                    <p className="text-gray-700">
                      {event.capacity} {pluralize(event.capacity, "Platz", "Plätze")}
                    </p>
                    {session && event.voteCounts && (
                      <p className="text-gray-700 mt-1">
                        {formatOccupancy(event.voteCounts, event.capacity)}
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Beschreibung</h2>
                  <div
                    className="event-description-content text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatEventDescriptionForDisplay(event.description) }}
                  />
                </div>

                <AlertBox type="error" message={voting.voteError} className="mb-4" />
              </div>
            </article>

            {!session && (
              <section className="card">
                <div className="p-6 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Teilnahmeanmeldung
                  </h2>
                  <p className="text-gray-600 mb-4 text-base sm:text-base">
                    Bitte einloggen, um Ihre Teilnahme anzumelden
                  </p>
                  <a href={loginUrl} className="btn-primary text-base font-semibold inline-block">
                    Zur Anmeldung bitte Einloggen
                  </a>
                </div>
              </section>
            )}

            {session && (
              <section className="card">
                <div className="p-0">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Teilnahmeanmeldung
                  </h2>

                  {isPast && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
                      Dieser Termin ist bereits vorbei. Teilnahmeanmeldungen sind nicht mehr möglich.
                    </div>
                  )}

                  <div className="mb-6 sm:mb-8">
                    <p className="text-gray-600 mb-3 sm:mb-4 text-base sm:text-base">
                      {isPast
                        ? voting.currentUserVote
                          ? "Sie haben sich für diesen Termin angemeldet:"
                          : "Keine Anmeldung vorhanden"
                        : voting.currentUserVote
                          ? "Sie haben sich bereits angemeldet:"
                          : "Melden Sie Ihre Teilnahme an:"}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {VOTE_OPTIONS.map((option) => (
                        <LoadingButton
                          key={option.value}
                          onClick={() => voting.handleVote(option.value)}
                          disabled={isPast || voting.isVoting}
                          loading={voting.isVoting && voting.pendingVote === option.value}
                          loadingText={option.label}
                          className={`px-4 sm:px-6 py-3 rounded-lg font-medium border-2 transition-all text-base sm:text-base touch-manipulation ${
                            voting.currentUserVote?.vote === option.value
                              ? `${option.color} border-current`
                              : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {option.label}
                        </LoadingButton>
                      ))}
                    </div>

                    {voting.currentUserVote && !isPast && (
                      <button
                        onClick={voting.handleDeleteVote}
                        disabled={voting.isVoting}
                        className="mt-3 sm:mt-4 text-base sm:text-base text-gray-500 hover:text-brand-red-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anmeldung zurückziehen
                      </button>
                    )}
                  </div>

                  {event.voteCounts && (
                    <VotingResults
                      votes={isAdminUser ? voting.editableVotesForAdmin : event.votes}
                      voteCounts={event.voteCounts}
                      isAdmin={isAdminUser}
                      onAddVote={
                        isAdminUser && voting.adminRegistrations && !voting.isAdminRegistrationsLoading
                          ? voting.openAddRegistrationModal
                          : undefined
                      }
                      onRemoveVote={
                        isAdminUser
                          ? (voteId, registration) => void voting.deleteRegistration(registration, voteId)
                          : undefined
                      }
                      registrationActionKey={voting.registrationActionKey}
                    />
                  )}
                </div>
              </section>
            )}

            {session && voting.eventPolls.length > 0 && (
              <section className="card mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Umfragen zu diesem Termin</h2>
                <div className="space-y-3">
                  {voting.eventPolls.map((poll) => (
                    <Link
                      key={poll.id}
                      href={`/umfragen/${poll.id}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:border-brand-red-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-gray-900 hover:text-brand-red-600">{poll.title}</span>
                        <div className="flex items-center gap-2">
                          {poll.userVoteOptionIds.length > 0 ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">Abgestimmt</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800">Offen</span>
                          )}
                          {poll.status === "CLOSED" && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">Geschlossen</span>
                          )}
                        </div>
                      </div>
                      {poll.description && (
                        <p className="text-sm text-gray-600 line-clamp-1">{poll.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {poll.options.length} Optionen · {poll._count.votes} Stimmen
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Bei offenem Modal zeigt die AlertBox im Modal den Fehler — der Toast läge
          unsichtbar hinter dem Overlay und würde doppelt per Screenreader angesagt */}
      {isAdminUser && !voting.isAddRegistrationModalOpen && (
        <AlertBox type="error" message={voting.adminRegistrationError} className="fixed bottom-4 right-4 shadow-lg z-40" />
      )}
      {isAdminUser && (
        <AlertBox type="success" message={voting.adminRegistrationSuccess} className="fixed bottom-4 left-4 shadow-lg z-40" />
      )}

      <Modal
        isOpen={voting.isAddRegistrationModalOpen}
        onClose={voting.closeAddRegistrationModal}
        title={`Anmeldung hinzufügen (${VOTE_OPTIONS.find((option) => option.value === voting.addRegistrationVote)?.label ?? "Ja"})`}
        size="lg"
      >
        <form onSubmit={voting.handleSubmitAddRegistration} className="space-y-5">
          <AlertBox type="error" message={voting.adminRegistrationError} />
          <div className="flex flex-wrap gap-5">
            <label className="inline-flex items-center gap-2.5 text-base text-gray-800">
              <input
                type="radio"
                name="registration-mode"
                value="member"
                checked={voting.addRegistrationMode === "member"}
                onChange={() => voting.setAddRegistrationMode("member")}
                className="h-4 w-4 accent-brand-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red-600/30"
              />
              Mitglied
            </label>
            <label className="inline-flex items-center gap-2.5 text-base text-gray-800">
              <input
                type="radio"
                name="registration-mode"
                value="guest"
                checked={voting.addRegistrationMode === "guest"}
                onChange={() => voting.setAddRegistrationMode("guest")}
                className="h-4 w-4 accent-brand-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red-600/30"
              />
              Gast
            </label>
          </div>

          {voting.addRegistrationMode === "member" ? (
            <div>
              <label htmlFor="member-select" className="form-label">
                Nicht angemeldetes Mitglied
              </label>
              <select
                id="member-select"
                value={voting.selectedMemberId}
                onChange={(e) => voting.setSelectedMemberId(e.target.value)}
                className="form-select"
              >
                <option value="">Bitte auswählen</option>
                {voting.unregisteredMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              {voting.unregisteredMembers.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">Es sind keine weiteren Mitglieder ohne Anmeldung verfügbar.</p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="guest-name" className="form-label">
                Gastname
              </label>
              <input
                id="guest-name"
                type="text"
                value={voting.guestName}
                onChange={(e) => voting.setGuestName(e.target.value)}
                className="form-input"
                placeholder="Name des Gasts"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={voting.closeAddRegistrationModal} className="btn-outline">
              Abbrechen
            </button>
            <LoadingButton
              type="submit"
              loading={voting.registrationActionKey === "create-registration"}
              loadingText="Speichern"
              className="btn-primary"
            >
              Hinzufügen
            </LoadingButton>
          </div>
        </form>
      </Modal>

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
    </main>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { formatDate, formatTime, isEventInPast } from "@/lib/date-utils";
import { VoteType } from "@prisma/client";
import { VotingResults, type Vote, type VoteCounts } from "@/components/voting-results";
import { EventMap } from "@/components/event-map";
import { EventFormModal } from "@/components/event-form-modal";
import { isAdmin } from "@/lib/role-utils";
import { VOTE_OPTIONS } from "@/lib/vote-utils";
import { BackLink } from "@/components/back-link";
import { ExternalLinkIcon } from "@/components/icons";
import { LoadingButton } from "@/components/loading-button";
import { useEventManagement } from "@/lib/use-event-management";
import { formatEventDescriptionForDisplay } from "@/lib/event-description";
import { buildLoginUrlWithReturnUrl } from "@/lib/return-url";
import type { Event } from "@/types";

interface EventWithVotes extends Event {
  votes?: Vote[];
  voteCounts?: VoteCounts;
  currentUserVote?: {
    id: string;
    vote: VoteType;
  } | null;
}

function getOpenStreetMapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<EventWithVotes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
  const [error, setError] = useState("");
  const [voteError, setVoteError] = useState("");
  const { data: session } = useSession();
  const isAdminUser = session ? isAdmin(session.user) : false;
  const eventManagement = useEventManagement({ enforceAdminRedirect: false, enabled: isAdminUser });

  // Get login URL with current event as return URL
  const loginUrl = typeof window !== "undefined" 
    ? buildLoginUrlWithReturnUrl(window.location.pathname)
    : "/login";

  useEffect(() => {
    fetchEvent(id);
  }, [id]);

  // Refresh event data after successful update
  useEffect(() => {
    if (eventManagement.success && !eventManagement.isModalOpen) {
      fetchEvent(id);
    }
  }, [eventManagement.success, eventManagement.isModalOpen, id]);

  async function fetchEvent(id: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/events/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Termin nicht gefunden");
        } else {
          throw new Error("Fehler beim Laden des Termins");
        }
        return;
      }

      const data: EventWithVotes = await response.json();
      setEvent(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVote(vote: VoteType) {
    if (!event || !session?.user?.id) return;

    setIsVoting(true);
    setPendingVote(vote);
    setVoteError("");

    try {
      const response = await fetch(`/api/events/${event.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setVoteError("Bitte einloggen, um deine Teilnahme anzumelden");
        } else {
          throw new Error("Fehler bei der Teilnahmeanmeldung");
        }
        return;
      }

      await fetchEvent(event.id);
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsVoting(false);
      setPendingVote(null);
    }
  }

  async function handleDeleteVote() {
    if (!event || !session?.user?.id) return;

    setIsVoting(true);
    setVoteError("");

    try {
      const response = await fetch(`/api/events/${event.id}/vote`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Zurückziehen der Anmeldung");
        return;
      }

      await fetchEvent(event.id);
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsVoting(false);
    }
  }

  // Compute current user's vote once to avoid repeated find calls
  const currentUserVote = session?.user?.id && event?.votes
    ? event.votes.find((v) => v.user.id === session.user.id)
    : event?.currentUserVote ?? undefined;

  // Check if event is in the past
  const isPast = event ? isEventInPast(event.date) : false;

  return (
    <main className="min-h-screen bg-gray-50">
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

        {eventManagement.success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {eventManagement.success}
          </div>
        )}

        {event && (
          <div className="space-y-6">
            <article className="card">
              <div className="p-0">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {formatDate(event.date)}
                    </h1>
                    {event.type && (
                      <span className={`px-3 py-1 text-base font-medium rounded ${
                        event.type === "Training" 
                          ? "bg-brand-blue-50 text-brand-blue-800" 
                          : "bg-orange-100 text-orange-800"
                      }`}>
                        {event.type}
                      </span>
                    )}
                  </div>
                  <p className="text-lg text-gray-600">
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
                  <p className="text-gray-700 mb-4">{event.location}</p>

                  {event.latitude !== null && event.longitude !== null && (
                    <EventMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                      location={event.location}
                    />
                  )}
                </div>

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Beschreibung</h2>
                  <div
                    className="event-description-content text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatEventDescriptionForDisplay(event.description) }}
                  />
                </div>

                {voteError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {voteError}
                  </div>
                )}
              </div>
            </article>

            {!session && (
              <section className="card">
                <div className="p-6 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Teilnahmeanmeldung
                  </h2>
                  <p className="text-gray-600 mb-4 text-base sm:text-base">
                    Bitte einloggen, um deine Teilnahme anzumelden
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
                        ? currentUserVote
                          ? "Du hast dich für diesen Termin angemeldet:"
                          : "Keine Anmeldung vorhanden"
                        : currentUserVote
                          ? "Du hast dich bereits angemeldet:"
                          : "Melde deine Teilnahme an:"}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {VOTE_OPTIONS.map((option) => (
                        <LoadingButton
                          key={option.value}
                          onClick={() => handleVote(option.value)}
                          disabled={isPast}
                          loading={isVoting && pendingVote === option.value}
                          loadingText={option.label}
                          className={`px-4 sm:px-6 py-3 rounded-lg font-medium border-2 transition-all text-base sm:text-base touch-manipulation ${
                            currentUserVote?.vote === option.value
                              ? `${option.color} border-current`
                              : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {option.label}
                        </LoadingButton>
                      ))}
                    </div>

                    {currentUserVote && !isPast && (
                      <button
                        onClick={handleDeleteVote}
                        disabled={isVoting}
                        className="mt-3 sm:mt-4 text-base sm:text-base text-gray-500 hover:text-brand-red-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anmeldung zurückziehen
                      </button>
                    )}
                  </div>

                  {event.voteCounts && (
                    <VotingResults votes={event.votes} voteCounts={event.voteCounts} isAdmin={isAdminUser} />
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

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
    </main>
  );
}

"use client";

import { FormEvent, useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { formatDate, formatTime, isEventInPast } from "@/lib/date-utils";
import { VoteType } from "@prisma/client";
import { VotingResults, type Vote, type VoteCounts, type EditableRegistration } from "@/components/voting-results";
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
import { Modal } from "@/components/modal";
import type { Event } from "@/types";

interface EventWithVotes extends Event {
  votes?: Vote[];
  voteCounts?: VoteCounts;
  currentUserVote?: {
    id: string;
    vote: VoteType;
  } | null;
}

interface AdminMemberRegistration {
  userId: string;
  name: string;
  vote: VoteType | null;
}

interface AdminGuestRegistration {
  id: string;
  name: string;
  vote: VoteType;
}

interface AdminRegistrations {
  members: AdminMemberRegistration[];
  guests: AdminGuestRegistration[];
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
  const [adminRegistrations, setAdminRegistrations] = useState<AdminRegistrations | null>(null);
  const [isAdminRegistrationsLoading, setIsAdminRegistrationsLoading] = useState(false);
  const [adminRegistrationError, setAdminRegistrationError] = useState("");
  const [adminRegistrationSuccess, setAdminRegistrationSuccess] = useState("");
  const [isAddRegistrationModalOpen, setIsAddRegistrationModalOpen] = useState(false);
  const [addRegistrationVote, setAddRegistrationVote] = useState<VoteType>(VoteType.JA);
  const [addRegistrationMode, setAddRegistrationMode] = useState<"member" | "guest">("member");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [registrationActionKey, setRegistrationActionKey] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isAdminUser) {
      setAdminRegistrations(null);
      setIsAdminRegistrationsLoading(false);
      return;
    }
    void fetchAdminRegistrations(id);
  }, [id, isAdminUser]);

  // Refresh event data after successful update
  useEffect(() => {
    if (eventManagement.success && !eventManagement.isModalOpen) {
      fetchEvent(id);
      if (isAdminUser) {
        void fetchAdminRegistrations(id);
      }
    }
  }, [eventManagement.success, eventManagement.isModalOpen, id, isAdminUser]);

  useEffect(() => {
    if (!adminRegistrationSuccess) return;
    const timer = window.setTimeout(() => setAdminRegistrationSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [adminRegistrationSuccess]);

  async function fetchEvent(id: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/events/${id}`, { cache: "no-store" });

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

  async function fetchAdminRegistrations(eventId: string) {
    setIsAdminRegistrationsLoading(true);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/registrations`, { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Fehler beim Laden der Anmeldungen");
      }

      setAdminRegistrations(json);
      setAdminRegistrationError("");
    } catch (err: unknown) {
      setAdminRegistrationError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsAdminRegistrationsLoading(false);
    }
  }

  function openAddRegistrationModal(vote: VoteType) {
    setAddRegistrationVote(vote);
    setAddRegistrationMode("member");
    setSelectedMemberId("");
    setGuestName("");
    setAdminRegistrationError("");
    setIsAddRegistrationModalOpen(true);
  }

  function closeAddRegistrationModal() {
    setIsAddRegistrationModalOpen(false);
    setSelectedMemberId("");
    setGuestName("");
  }

  async function addRegistration() {
    if (!event) {
      return;
    }

    if (addRegistrationMode === "member" && !selectedMemberId) {
      setAdminRegistrationError("Bitte ein Mitglied auswählen.");
      return;
    }

    if (addRegistrationMode === "guest" && !guestName.trim()) {
      setAdminRegistrationError("Bitte einen Gastnamen eingeben.");
      return;
    }

    setRegistrationActionKey("create-registration");
    setAdminRegistrationError("");
    setAdminRegistrationSuccess("");

    try {
      const response = await fetch(`/api/admin/events/${event.id}/registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          addRegistrationMode === "member"
            ? { type: "member", userId: selectedMemberId, vote: addRegistrationVote }
            : { type: "guest", name: guestName.trim(), vote: addRegistrationVote }
        ),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Fehler beim Speichern");
      }

      await Promise.all([fetchEvent(event.id), fetchAdminRegistrations(event.id)]);
      setAdminRegistrationSuccess(
        addRegistrationMode === "member" ? "Mitgliedsanmeldung gespeichert" : "Gastanmeldung gespeichert"
      );
      closeAddRegistrationModal();
    } catch (err: unknown) {
      setAdminRegistrationError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setRegistrationActionKey(null);
    }
  }

  function handleSubmitAddRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void addRegistration();
  }

  async function deleteRegistration(registration: EditableRegistration, voteId: string) {
    if (!event) {
      return;
    }

    const confirmationMessage =
      registration.type === "member"
        ? `Teilnahmeanmeldung von "${registration.name}" wirklich entfernen?`
        : `Gastanmeldung "${registration.name}" wirklich entfernen?`;

    if (!confirm(confirmationMessage)) {
      return;
    }

    setRegistrationActionKey(`delete-${voteId}`);
    setAdminRegistrationError("");
    setAdminRegistrationSuccess("");

    try {
      const response = await fetch(`/api/admin/events/${event.id}/registrations`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          registration.type === "member"
            ? { type: "member", userId: registration.userId }
            : { type: "guest", name: registration.name }
        ),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Fehler beim Löschen");
      }

      await Promise.all([fetchEvent(event.id), fetchAdminRegistrations(event.id)]);
      setAdminRegistrationSuccess(
        registration.type === "member" ? "Mitgliedsanmeldung entfernt" : "Gastanmeldung entfernt"
      );
    } catch (err: unknown) {
      setAdminRegistrationError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setRegistrationActionKey(null);
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

      setEvent((prev) => {
        if (!prev) {
          return prev;
        }

        const existingVote = prev.votes
          ? prev.votes.find((vote) => vote.user.id === session.user.id)
          : prev.currentUserVote ?? null;

        if (!existingVote) {
          return {
            ...prev,
            currentUserVote: null,
          };
        }

        const nextVoteCounts = prev.voteCounts
          ? {
              ...prev.voteCounts,
              [existingVote.vote]: Math.max(0, prev.voteCounts[existingVote.vote] - 1),
            }
          : prev.voteCounts;

        return {
          ...prev,
          votes: prev.votes ? prev.votes.filter((vote) => vote.user.id !== session.user.id) : prev.votes,
          voteCounts: nextVoteCounts,
          currentUserVote: null,
        };
      });

      if (isAdminUser) {
        setAdminRegistrations((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            members: prev.members.map((member) =>
              member.userId === session.user.id ? { ...member, vote: null } : member
            ),
          };
        });
      }

      await fetchEvent(event.id);
      if (isAdminUser) {
        await fetchAdminRegistrations(event.id);
      }
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

  const editableVotesForAdmin: Vote[] = adminRegistrations
    ? [
        ...adminRegistrations.members
          .filter((member) => member.vote !== null)
          .map((member) => ({
            id: `member-${member.userId}`,
            vote: member.vote as VoteType,
            user: {
              id: member.userId,
              name: member.name,
            },
            registration: {
              type: "member" as const,
              userId: member.userId,
              name: member.name,
            },
          })),
        ...adminRegistrations.guests.map((guest) => ({
          id: `guest-${guest.id}`,
          vote: guest.vote,
          user: {
            id: `guest-${guest.id}`,
            name: `${guest.name} (Gast)`,
          },
          registration: {
            type: "guest" as const,
            name: guest.name,
          },
        })),
      ]
    : [];

  const unregisteredMembers = adminRegistrations
    ? adminRegistrations.members.filter((member) => member.vote === null)
    : [];

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
                  <p className="text-gray-700 mb-4">{event.locationDisplay || event.location}</p>

                  {event.latitude !== null && event.longitude !== null && (
                    <EventMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                      location={event.locationDisplay || event.location}
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
                    <VotingResults
                      votes={isAdminUser ? editableVotesForAdmin : event.votes}
                      voteCounts={event.voteCounts}
                      isAdmin={isAdminUser}
                      onAddVote={
                        isAdminUser && adminRegistrations && !isAdminRegistrationsLoading
                          ? openAddRegistrationModal
                          : undefined
                      }
                      onRemoveVote={
                        isAdminUser
                          ? (voteId, registration) => void deleteRegistration(registration, voteId)
                          : undefined
                      }
                      registrationActionKey={registrationActionKey}
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {isAdminUser && adminRegistrationError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-40">
          {adminRegistrationError}
        </div>
      )}
      {isAdminUser && adminRegistrationSuccess && (
        <div className="fixed bottom-4 left-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-40">
          {adminRegistrationSuccess}
        </div>
      )}

      <Modal
        isOpen={isAddRegistrationModalOpen}
        onClose={closeAddRegistrationModal}
        title={`Anmeldung hinzufügen (${VOTE_OPTIONS.find((option) => option.value === addRegistrationVote)?.label ?? "Ja"})`}
        size="lg"
      >
        <form onSubmit={handleSubmitAddRegistration} className="space-y-5">
          <div className="flex flex-wrap gap-5">
            <label className="inline-flex items-center gap-2.5 text-base text-gray-800">
              <input
                type="radio"
                name="registration-mode"
                value="member"
                checked={addRegistrationMode === "member"}
                onChange={() => setAddRegistrationMode("member")}
                className="h-4 w-4 accent-brand-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red-600/30"
              />
              Mitglied
            </label>
            <label className="inline-flex items-center gap-2.5 text-base text-gray-800">
              <input
                type="radio"
                name="registration-mode"
                value="guest"
                checked={addRegistrationMode === "guest"}
                onChange={() => setAddRegistrationMode("guest")}
                className="h-4 w-4 accent-brand-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red-600/30"
              />
              Gast
            </label>
          </div>

          {addRegistrationMode === "member" ? (
            <div>
              <label htmlFor="member-select" className="form-label">
                Nicht angemeldetes Mitglied
              </label>
              <select
                id="member-select"
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="form-select"
              >
                <option value="">Bitte auswählen</option>
                {unregisteredMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              {unregisteredMembers.length === 0 && (
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
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="form-input"
                placeholder="Name des Gasts"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeAddRegistrationModal} className="btn-outline">
              Abbrechen
            </button>
            <LoadingButton
              type="submit"
              loading={registrationActionKey === "create-registration"}
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
        initialEventData={eventManagement.initialEventData}
        isGeocoding={eventManagement.isGeocoding}
        onGeocode={eventManagement.handleGeocode}
        geocodeSuccess={eventManagement.geocodeSuccess}
        onUseLastDescription={eventManagement.handleUseLatestDescription}
        isLoadingLastDescription={eventManagement.isLoadingLatestDescription}
      />
    </main>
  );
}

import { FormEvent, useState, useEffect, useCallback } from "react";
import { VoteType } from "@prisma/client";
import type { Vote, EditableRegistration } from "@/components/voting-results";
import type { EventWithVotes } from "@/lib/use-event-detail";
import { useConfirmDialog } from "@/components/confirm-dialog";

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

interface UseAdminRegistrationsParams {
  eventId: string;
  event: EventWithVotes | null;
  fetchEvent: (id: string) => Promise<void>;
  isAdminUser: boolean;
}

/**
 * Admin-Sicht der Teilnahmeanmeldungen eines Termins: Liste laden,
 * Mitglieds-/Gastanmeldungen anlegen und entfernen inklusive Modal-State.
 */
export function useAdminRegistrations({
  eventId,
  event,
  fetchEvent,
  isAdminUser,
}: UseAdminRegistrationsParams) {
  const confirm = useConfirmDialog();
  const [registrations, setRegistrations] = useState<AdminRegistrations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addVote, setAddVote] = useState<VoteType>(VoteType.JA);
  const [addMode, setAddMode] = useState<"member" | "guest">("member");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/events/${id}/registrations`, { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Fehler beim Laden der Anmeldungen");
      }

      setRegistrations(json);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminUser) {
      setRegistrations(null);
      setIsLoading(false);
      return;
    }
    void fetchRegistrations(eventId);
  }, [eventId, isAdminUser, fetchRegistrations]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  function openAddModal(vote: VoteType) {
    setAddVote(vote);
    setAddMode("member");
    setSelectedMemberId("");
    setGuestName("");
    setError("");
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setSelectedMemberId("");
    setGuestName("");
  }

  async function addRegistration() {
    if (!event) return;

    if (addMode === "member" && !selectedMemberId) {
      setError("Bitte ein Mitglied auswählen.");
      return;
    }

    if (addMode === "guest" && !guestName.trim()) {
      setError("Bitte einen Gastnamen eingeben.");
      return;
    }

    setActionKey("create-registration");
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/events/${event.id}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          addMode === "member"
            ? { type: "member", userId: selectedMemberId, vote: addVote }
            : { type: "guest", name: guestName.trim(), vote: addVote }
        ),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Fehler beim Speichern");
      }

      await Promise.all([fetchEvent(event.id), fetchRegistrations(event.id)]);
      setSuccess(
        addMode === "member" ? "Mitgliedsanmeldung gespeichert" : "Gastanmeldung gespeichert"
      );
      closeAddModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setActionKey(null);
    }
  }

  function handleSubmitAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void addRegistration();
  }

  async function deleteRegistration(registration: EditableRegistration, voteId: string) {
    if (!event) return;

    const confirmationMessage =
      registration.type === "member"
        ? `Teilnahmeanmeldung von "${registration.name}" wirklich entfernen?`
        : `Gastanmeldung "${registration.name}" wirklich entfernen?`;

    if (!await confirm({
      message: confirmationMessage,
      confirmLabel: "Entfernen",
      variant: "danger",
    })) return;

    setActionKey(`delete-${voteId}`);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/events/${event.id}/registrations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
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

      await Promise.all([fetchEvent(event.id), fetchRegistrations(event.id)]);
      setSuccess(
        registration.type === "member" ? "Mitgliedsanmeldung entfernt" : "Gastanmeldung entfernt"
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setActionKey(null);
    }
  }

  /** Optimistisches Update, wenn ein Mitglied die eigene Anmeldung zurückzieht. */
  const applyOwnVoteWithdrawn = useCallback((userId: string) => {
    setRegistrations((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        members: prev.members.map((member) =>
          member.userId === userId ? { ...member, vote: null } : member
        ),
      };
    });
  }, []);

  const editableVotes: Vote[] = registrations
    ? [
        ...registrations.members
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
        ...registrations.guests.map((guest) => ({
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

  const unregisteredMembers = registrations
    ? registrations.members.filter((member) => member.vote === null)
    : [];

  return {
    registrations,
    isLoading,
    error,
    success,
    editableVotes,
    unregisteredMembers,
    isAddModalOpen,
    addVote,
    addMode,
    setAddMode,
    selectedMemberId,
    setSelectedMemberId,
    guestName,
    setGuestName,
    actionKey,
    openAddModal,
    closeAddModal,
    handleSubmitAdd,
    deleteRegistration,
    applyOwnVoteWithdrawn,
    refresh: useCallback(() => fetchRegistrations(eventId), [fetchRegistrations, eventId]),
  };
}

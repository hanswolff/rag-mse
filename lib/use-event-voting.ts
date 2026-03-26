import { FormEvent, useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { VoteType } from "@prisma/client";
import type { Session } from "next-auth";
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

export interface EventPoll {
  id: string;
  title: string;
  description: string | null;
  status: string;
  multipleChoice: boolean;
  shortCode: string | null;
  options: { id: string; text: string; position: number; _count: { votes: number } }[];
  _count: { votes: number };
  userVoteOptionIds: string[];
}

interface UseEventVotingParams {
  eventId: string;
  event: EventWithVotes | null;
  setEvent: Dispatch<SetStateAction<EventWithVotes | null>>;
  fetchEvent: (id: string) => Promise<void>;
  session: Session | null;
  isAdminUser: boolean;
}

export function useEventVoting({
  eventId,
  event,
  setEvent,
  fetchEvent,
  session,
  isAdminUser,
}: UseEventVotingParams) {
  const [isVoting, setIsVoting] = useState(false);
  const confirm = useConfirmDialog();
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
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
  const [eventPolls, setEventPolls] = useState<EventPoll[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/polls?type=TERMIN&eventId=${encodeURIComponent(eventId)}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setEventPolls(data.polls || []);
      })
      .catch(() => setEventPolls([]));
  }, [eventId, session]);

  const fetchAdminRegistrations = useCallback(async (id: string) => {
    setIsAdminRegistrationsLoading(true);
    try {
      const response = await fetch(`/api/admin/events/${id}/registrations`, { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    if (!isAdminUser) {
      setAdminRegistrations(null);
      setIsAdminRegistrationsLoading(false);
      return;
    }
    void fetchAdminRegistrations(eventId);
  }, [eventId, isAdminUser, fetchAdminRegistrations]);

  useEffect(() => {
    if (!adminRegistrationSuccess) return;
    const timer = window.setTimeout(() => setAdminRegistrationSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [adminRegistrationSuccess]);

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
    if (!event) return;

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
        headers: { "Content-Type": "application/json" },
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

  function handleSubmitAddRegistration(e: FormEvent<HTMLFormElement>) {
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

    setRegistrationActionKey(`delete-${voteId}`);
    setAdminRegistrationError("");
    setAdminRegistrationSuccess("");

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
        headers: { "Content-Type": "application/json" },
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
        if (!prev) return prev;

        const existingVote = prev.votes
          ? prev.votes.find((vote) => vote.user.id === session.user.id)
          : prev.currentUserVote ?? null;

        if (!existingVote) {
          return { ...prev, currentUserVote: null };
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
          if (!prev) return prev;
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

  return {
    isVoting,
    pendingVote,
    voteError,
    currentUserVote,
    handleVote,
    handleDeleteVote,
    adminRegistrations,
    isAdminRegistrationsLoading,
    adminRegistrationError,
    adminRegistrationSuccess,
    editableVotesForAdmin,
    unregisteredMembers,
    isAddRegistrationModalOpen,
    addRegistrationVote,
    addRegistrationMode,
    setAddRegistrationMode,
    selectedMemberId,
    setSelectedMemberId,
    guestName,
    setGuestName,
    registrationActionKey,
    openAddRegistrationModal,
    closeAddRegistrationModal,
    handleSubmitAddRegistration,
    deleteRegistration,
    eventPolls,
    refreshAdminRegistrations: useCallback(() => fetchAdminRegistrations(eventId), [fetchAdminRegistrations, eventId]),
  };
}

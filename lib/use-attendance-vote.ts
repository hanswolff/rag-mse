import { useState, useRef } from "react";
import { VoteType } from "@prisma/client";
import type { Session } from "next-auth";
import type { Dispatch, SetStateAction } from "react";
import type { EventWithVotes } from "@/lib/use-event-detail";

interface UseAttendanceVoteParams {
  event: EventWithVotes | null;
  setEvent: Dispatch<SetStateAction<EventWithVotes | null>>;
  fetchEvent: (id: string) => Promise<void>;
  session: Session | null;
  /** Optimistisches Update der Admin-Anmeldeliste, wenn die eigene Anmeldung zurückgezogen wird. */
  onOwnVoteWithdrawn?: (userId: string) => void;
  /** Refetch der Admin-Anmeldeliste nach dem Zurückziehen der eigenen Anmeldung. */
  refreshRegistrations?: () => Promise<void>;
}

/**
 * Eigene Teilnahmeanmeldung (Ja/Nein/Vielleicht) auf der Termin-Detailseite:
 * abstimmen, zurückziehen (mit optimistischem Update) und der aktuelle Stand.
 */
export function useAttendanceVote({
  event,
  setEvent,
  fetchEvent,
  session,
  onOwnVoteWithdrawn,
  refreshRegistrations,
}: UseAttendanceVoteParams) {
  const [isVoting, setIsVoting] = useState(false);
  // Doppel-Submit-Schutz: State-Updates greifen erst beim Re-Render, der Ref sofort
  const isVotingRef = useRef(false);
  const [pendingVote, setPendingVote] = useState<VoteType | null>(null);
  const [voteError, setVoteError] = useState("");

  async function handleVote(vote: VoteType) {
    if (!event || !session?.user?.id) return;
    if (isVotingRef.current) return;

    isVotingRef.current = true;
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
          setVoteError("Bitte einloggen, um Ihre Teilnahme anzumelden");
        } else {
          throw new Error("Fehler bei der Teilnahmeanmeldung");
        }
        return;
      }

      await fetchEvent(event.id);
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      isVotingRef.current = false;
      setIsVoting(false);
      setPendingVote(null);
    }
  }

  async function handleDeleteVote() {
    if (!event || !session?.user?.id) return;
    if (isVotingRef.current) return;

    isVotingRef.current = true;
    setIsVoting(true);
    setVoteError("");

    try {
      const response = await fetch(`/api/events/${event.id}/vote`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Zurückziehen der Anmeldung");
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

      onOwnVoteWithdrawn?.(session.user.id);

      await fetchEvent(event.id);
      if (refreshRegistrations) {
        await refreshRegistrations();
      }
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      isVotingRef.current = false;
      setIsVoting(false);
    }
  }

  const currentUserVote = session?.user?.id && event?.votes
    ? event.votes.find((v) => v.user.id === session.user.id)
    : event?.currentUserVote ?? undefined;

  return {
    isVoting,
    pendingVote,
    voteError,
    currentUserVote,
    handleVote,
    handleDeleteVote,
  };
}

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { VoteType } from "@prisma/client";
import { formatDate, isEventInPast } from "@/lib/date-utils";
import { buildLoginUrlWithReturnUrl } from "@/lib/return-url";
import type { Vote, VoteCounts } from "@/components/voting-results";
import type { Event } from "@/types";
import { appName } from "@/lib/site-config";

export interface EventWithVotes extends Event {
  votes?: Vote[];
  voteCounts?: VoteCounts;
  currentUserVote?: {
    id: string;
    vote: VoteType;
  } | null;
}

export interface UseEventDetailReturn {
  event: EventWithVotes | null;
  setEvent: Dispatch<SetStateAction<EventWithVotes | null>>;
  isLoading: boolean;
  error: string;
  fetchEvent: (id: string) => Promise<void>;
  isPast: boolean;
  eventJsonLd: Record<string, unknown> | null;
  loginUrl: string;
}

export function useEventDetail(id: string): UseEventDetailReturn {
  const [event, setEvent] = useState<EventWithVotes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loginUrl = typeof window !== "undefined"
    ? buildLoginUrlWithReturnUrl(window.location.pathname)
    : "/login";

  const fetchEvent = useCallback(async (eventId: string) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/events/${eventId}`, { cache: "no-store" });

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
  }, []);

  useEffect(() => {
    fetchEvent(id);
  }, [id, fetchEvent]);

  const isPast = event ? isEventInPast(event.date) : false;

  const eventJsonLd = event
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: `Termin am ${formatDate(event.date)}`,
        startDate: `${event.date}T${event.timeFrom}:00`,
        endDate: `${event.date}T${event.timeTo}:00`,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: event.locationDisplay || event.location,
          address: event.locationDisplay || event.location,
        },
        organizer: {
          "@type": "Organization",
          name: appName,
        },
        description: event.description.replace(/\s+/g, " ").trim().slice(0, 220),
      }
    : null;

  return {
    event,
    setEvent,
    isLoading,
    error,
    fetchEvent,
    isPast,
    eventJsonLd,
    loginUrl,
  };
}

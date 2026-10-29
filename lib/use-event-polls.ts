import { useState, useEffect } from "react";
import type { Session } from "next-auth";

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

/**
 * Lädt die mit einem Termin verknüpften Umfragen für eingeloggte Benutzer.
 */
export function useEventPolls(eventId: string, session: Session | null): EventPoll[] {
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

  return eventPolls;
}

"use client";

import { useEffect, useState } from "react";
import { API_ROUTES } from "./api-routes";

// Badge-Zähler der Navigation: offene Umfragen (Benutzermenü) und laufende
// Ausschreibungen (Infos-Menü). Beide Abrufe schlagen still fehl — die Badges
// sind optional.
export function useNavBadges(status: "loading" | "authenticated" | "unauthenticated", canAccessSelfServiceMenu: boolean) {
  const [openPollsCount, setOpenPollsCount] = useState(0);
  const [openAusschreibungenCount, setOpenAusschreibungenCount] = useState(0);

  // Fetch open polls count for badge in user menu
  useEffect(() => {
    if (status !== "authenticated" || !canAccessSelfServiceMenu) return;

    let ignore = false;
    const fetchOpenPollsCount = async () => {
      try {
        const response = await fetch("/api/polls?status=LIVE&limit=50");
        if (!response.ok || ignore) return;
        const data = await response.json();
        // Count polls where user hasn't voted
        const count = data.polls.filter(
          (poll: { userVoteOptionIds: string[] }) => poll.userVoteOptionIds.length === 0
        ).length;
        if (!ignore) setOpenPollsCount(count);
      } catch {
        // Silently fail - badge is optional
      }
    };

    void fetchOpenPollsCount();

    // Listen for poll vote changes to refresh badge
    const handlePollVoteChanged = () => {
      void fetchOpenPollsCount();
    };

    window.addEventListener("poll-vote-changed", handlePollVoteChanged);
    return () => {
      ignore = true;
      window.removeEventListener("poll-vote-changed", handlePollVoteChanged);
    };
  }, [status, canAccessSelfServiceMenu]);

  // Badge im Infos-Menü: Anzahl der noch laufenden Ausschreibungen. Die Route ist
  // öffentlich und liefert die Aufteilung aktuell/historisch bereits fertig, das
  // Badge hängt daher nicht am Login-Status.
  useEffect(() => {
    let ignore = false;

    const fetchOpenAusschreibungenCount = async () => {
      try {
        const response = await fetch(API_ROUTES.AUSSCHREIBUNGEN);
        if (!response.ok || ignore) return;
        const data = await response.json();
        if (!ignore) {
          setOpenAusschreibungenCount(Array.isArray(data.current) ? data.current.length : 0);
        }
      } catch {
        // Silently fail - badge is optional
      }
    };

    void fetchOpenAusschreibungenCount();

    return () => {
      ignore = true;
    };
  }, []);

  return { openPollsCount, openAusschreibungenCount };
}

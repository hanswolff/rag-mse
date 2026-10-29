"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { API_ROUTES } from "@/lib/api-routes";
import type { CalendarData, CalendarRange } from "@/lib/calendar-service";

export const CALENDAR_LOAD_ERROR = "Der Kalender konnte nicht geladen werden. Bitte versuchen Sie es erneut.";

interface LoadedCalendar {
  range: CalendarRange;
  data: CalendarData;
}

export function useCalendarData(range: CalendarRange | null, viewerId: string | null) {
  const [loaded, setLoaded] = useState<LoadedCalendar | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    apiFetch<CalendarData>(`${API_ROUTES.CALENDAR}?${new URLSearchParams({ von: from, bis: to })}`, {
      signal: controller.signal,
      fallbackError: CALENDAR_LOAD_ERROR,
    })
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ range: { from, to }, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(CALENDAR_LOAD_ERROR);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [from, to, viewerId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { loaded, isLoading, error, reload };
}

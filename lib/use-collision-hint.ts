"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { API_ROUTES } from "@/lib/api-routes";
import { formatCollisionHint } from "@/lib/collision-hint";
import type { CollisionDay } from "@/lib/collision-service";
import { parseStrictIsoDate } from "@/lib/date-picker-utils";

export const COLLISION_HINT_DEBOUNCE_MS = 400;

function buildUrl(date: string, excludeTerminId?: string): string {
  const params = new URLSearchParams({ datum: date });
  if (excludeTerminId) params.set("ohneTermin", excludeTerminId);
  return `${API_ROUTES.ADMIN.COLLISIONS}?${params}`;
}

export function useCollisionHint(date: string, excludeTerminId: string | undefined, enabled: boolean): string | null {
  const url = enabled && parseStrictIsoDate(date) ? buildUrl(date, excludeTerminId) : null;
  const [result, setResult] = useState<{ url: string; hint: string | null } | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<CollisionDay>(url, { signal: controller.signal })
        .then((day) => {
          if (!controller.signal.aborted) setResult({ url, hint: formatCollisionHint(day) });
        })
        .catch(() => undefined);
    }, COLLISION_HINT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setResult(null);
    };
  }, [url]);

  return result?.url === url ? result.hint : null;
}

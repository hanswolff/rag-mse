import type { ExternalEventItem } from "@/types";

export function splitExternalEventsByDate(externalEvents: ExternalEventItem[], today: string) {
  const upcoming = externalEvents
    .filter((externalEvent) => externalEvent.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = externalEvents
    .filter((externalEvent) => externalEvent.endDate < today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  return { upcoming, past };
}

import type { CollisionDay } from "@/lib/collision-service";
import { formatDate } from "@/lib/date-utils";
import { EXTERNAL_EVENT_KIND_LABELS } from "@/lib/external-event-kind";
import { pluralize } from "@/lib/pluralization";

const WEEKDAYS = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];

export function formatWeekdayDate(isoDate: string): string {
  return `${WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]}, ${formatDate(isoDate)}`;
}

export function formatCollisionHint(day: CollisionDay): string | null {
  const parts = [
    ...day.fremdtermine.map((fremdtermin) => {
      const kind = fremdtermin.kind ? `${EXTERNAL_EVENT_KIND_LABELS[fremdtermin.kind]} ` : "";
      return `${kind}„${fremdtermin.title}“ (Fremdtermin)`;
    }),
    ...day.termine.map((termin) => `${termin.label} ${termin.timeFrom} Uhr (Termin)`),
  ];
  const { count, names } = day.abwesenheiten;
  if (count > 0) {
    const label = `${count} ${pluralize(count, "Abwesenheit", "Abwesenheiten")}`;
    parts.push(names.length > 0 ? `${label} (${names.join(", ")})` : label);
  }
  if (parts.length === 0) return null;
  return `Am ${formatWeekdayDate(day.date)} außerdem: ${parts.join(", ")}`;
}

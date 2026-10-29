import type { NormalizedPeriod } from "../validation/period";
import { formatDateUtc } from "./format";

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatPeriod({ startDate, endDate, allDay, timeFrom, timeTo }: NormalizedPeriod): string {
  const start = formatDateUtc(startDate);
  const end = formatDateUtc(endDate);
  if (allDay || !timeFrom || !timeTo) {
    return startDate === endDate ? start : `${start} – ${end}`;
  }
  if (startDate === endDate) {
    return `${start}, ${timeFrom}–${timeTo} Uhr`;
  }
  return `${start}, ${timeFrom} Uhr – ${end}, ${timeTo} Uhr`;
}

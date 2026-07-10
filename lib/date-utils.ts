import { parseISO, startOfDay, isBefore, isValid } from "date-fns";

// Anzeige-Zeitzone der Anwendung. Vollständige Timestamps (Instants) werden im
// Berliner Kalenderdatum angezeigt — unabhängig von der Server-Zeitzone. Reine
// Datumsstrings ("2026-08-01") bleiben zeitzonenfrei.
const APP_DISPLAY_TIMEZONE =
  (typeof process !== "undefined" && process.env?.APP_TIMEZONE) || "Europe/Berlin";

const berlinDateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: APP_DISPLAY_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(dateString: string): string {
  const trimmed = dateString.trim();

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]}.${dateOnlyMatch[2]}.${dateOnlyMatch[1]}`;
  }

  const parsedDate = parseISO(trimmed);
  if (!isValid(parsedDate)) {
    return dateString;
  }

  return berlinDateFormatter.format(parsedDate);
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  return `${hours}:${minutes}`;
}

export function formatDateTimeRange(
  dateString: string,
  timeFrom: string,
  timeTo?: string
): string {
  const formattedDate = formatDate(dateString);
  const formattedTimeFrom = formatTime(timeFrom);
  const formattedTimeTo = timeTo ? formatTime(timeTo) : undefined;
  return formattedTimeTo ? `${formattedDate}, ${formattedTimeFrom} - ${formattedTimeTo}` : `${formattedDate}, ${formattedTimeFrom}`;
}

export function isEventInPast(eventDate: string | Date): boolean {
  const eventDateObj = typeof eventDate === 'string' ? parseISO(eventDate) : eventDate;
  const today = startOfDay(new Date());
  return isBefore(eventDateObj, today);
}

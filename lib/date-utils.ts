import { parseISO, format, startOfDay, isBefore } from "date-fns";

export function formatDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "dd.MM.yyyy");
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

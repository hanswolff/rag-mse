import { parse, isValid, parseISO, format, startOfDay, setHours, setMinutes } from "date-fns";

export function parseISODate(dateString: string): Date | null {
  if (!dateString) return null;

  const parsed = parseISO(dateString);
  return isValid(parsed) ? parsed : null;
}

export function parseTime(timeString: string): Date | null {
  if (!timeString) return null;
  const parsed = parse(timeString, 'HH:mm', new Date());
  return isValid(parsed) ? parsed : null;
}

export function normalizeDateInputValue(value: string | null | undefined): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const isoLikeMatch = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(trimmed);
  if (isoLikeMatch) {
    return isoLikeMatch[1];
  }

  const germanMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (germanMatch) {
    return `${germanMatch[3]}-${germanMatch[2]}-${germanMatch[1]}`;
  }

  return "";
}

export function formatDateInputValue(date: Date | null | undefined): string | null {
  if (!date) return null;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForStorage(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDateOnlyToUtcDate(dateString: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    throw new Error(`Invalid ISO date-only string: ${dateString}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function getStartOfToday(): Date {
  return startOfDay(new Date());
}

export function parseDateAndTime(dateString: string, timeString: string): Date {
  const baseDate = parseISO(dateString);
  if (!isValid(baseDate)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time string: ${timeString}`);
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time string: ${timeString}`);
  }

  return setMinutes(setHours(baseDate, hours), minutes);
}

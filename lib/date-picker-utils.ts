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

export function formatDateForStorage(date: Date): string {
  return format(date, 'yyyy-MM-dd');
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

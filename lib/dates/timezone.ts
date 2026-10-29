import { parseTimeParts } from "./time";

// Zeitzonen-sichere Umrechnung zwischen Wandzeit in der App-Zeitzone und UTC
// über Intl — unabhängig von der Server-Zeitzone (funktioniert auch ohne
// TZ=Europe/Berlin, z. B. in CI oder bei einem Hoster-Wechsel).
const DEFAULT_APP_TIMEZONE = "Europe/Berlin";

export function getAppTimeZone(): string {
  const configured =
    typeof process !== "undefined" ? process.env?.APP_TIMEZONE?.trim() : undefined;
  return configured || DEFAULT_APP_TIMEZONE;
}

export type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getTimeZoneDateParts(date: Date, timeZone: string): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number.parseInt(value || "0", 10);
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getTimeZoneDateParts(date, timeZone);
  const utcFromZoned = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
    0
  );
  return utcFromZoned - date.getTime();
}

export function zonedTimeToUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}, timeZone: string): Date {
  const second = parts.second ?? 0;
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, second, 0);
  let utcGuess = targetUtc;

  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
    utcGuess = targetUtc - offset;
  }

  return new Date(utcGuess);
}

// Kombiniert den Kalendertag des Termins (interpretiert in der App-Zeitzone)
// mit einer Uhrzeit „HH:mm“ zur exakten UTC-Startzeit des Termins.
export function buildEventDateTime(
  eventDate: Date,
  time: string,
  timeZone: string = getAppTimeZone()
): Date {
  const { hours, minutes } = parseTimeParts(time);
  const eventDateParts = getTimeZoneDateParts(eventDate, timeZone);
  return zonedTimeToUtc(
    {
      year: eventDateParts.year,
      month: eventDateParts.month,
      day: eventDateParts.day,
      hour: hours,
      minute: minutes,
      second: 0,
    },
    timeZone
  );
}

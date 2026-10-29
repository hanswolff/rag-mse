import { parseISODate, formatDateForStorage } from "../date-picker-utils";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_UTC_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

// Datum + Uhrzeit für Admin-Listen (bewusst in der Zeitzone des Betrachters).
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_TIME_FORMATTER.format(date);
}

// Reines Datum als UTC-Kalendertag — für Werte, die als UTC-Mitternacht
// gespeichert sind (Dokumente, Ausschreibungen).
export function formatDateUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_UTC_FORMATTER.format(date);
}

// Für <input type="date">: UTC-Kalendertag des Zeitstempels, passend zu
// formatDateUtc (Dokument-/Ausschreibungs-Datumswerte). Ungültig → "".
export function formatDateOnlyForInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

// Für <input type="date">: Kalendertag in lokaler Zeit — Termin-Datumswerte
// tragen die Wandzeit, und reine Datumsstrings ("2026-06-05") bleiben in jeder
// Zeitzone unverändert. Bewusst andere Semantik als formatDateOnlyForInput;
// ungültige Werte kommen unverändert zurück.
export function formatLocalDateForInput(value: string): string {
  const date = parseISODate(value);
  if (!date) {
    return value;
  }
  return formatDateForStorage(date);
}

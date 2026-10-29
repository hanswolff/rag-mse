import { appName } from "@/lib/site-config";
import {
  addDaysToIsoDate,
  getAppTimeZone,
  getTimeZoneDateParts,
  isTimeRangeValid,
  parseTimeParts,
  zonedTimeToUtc,
} from "@/lib/dates";
import { getTerminTitle } from "@/lib/event-types";
import { getEventDescriptionPreview, truncateText } from "@/lib/event-description";
import { isHttpUrl } from "@/lib/validation/external-event";
import { EXTERNAL_EVENT_KIND_LABELS, ExternalEventKind } from "@/lib/external-event-kind";

interface CalendarEventOptions {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}

// ICS-„floating time“ (bewusst ohne TZID/VTIMEZONE): Kalenderclients zeigen die
// Wandzeit unverändert an. Die Wandzeit wird über die App-Zeitzone berechnet,
// damit das Ergebnis nicht von der Server-Zeitzone abhängt.
function toIcsDateTimeLocal(date: Date): string {
  const parts = getTimeZoneDateParts(date, getAppTimeZone());
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const second = String(parts.second).padStart(2, "0");
  return `${parts.year}${month}${day}T${hour}${minute}${second}`;
}

function toIcsDateTimeUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function escapeIcsValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildCalendarEvent(options: CalendarEventOptions): string {
  const dtStamp = toIcsDateTimeUtc(new Date());
  const dtStart = toIcsDateTimeLocal(options.start);
  const dtEnd = toIcsDateTimeLocal(options.end);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${appName}//Termine//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsValue(options.uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsValue(options.title)}`,
    `DESCRIPTION:${escapeIcsValue(options.description)}`,
    `LOCATION:${escapeIcsValue(options.location)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export const CALENDAR_FEED_REFRESH = "PT6H";
export const CALENDAR_FEED_MAX_DESCRIPTION_CHARS = 2000;

const MAX_LINE_OCTETS = 75;
const utf8 = new TextEncoder();

export interface FeedTermin {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string | null;
  type: string | null;
  location: string;
  description: string;
  updatedAt: Date;
}

export interface FeedFremdtermin {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  kind: ExternalEventKind | null;
  updatedAt: Date;
}

export interface CalendarFeedInput {
  termine: FeedTermin[];
  fremdtermine: FeedFremdtermin[];
  baseUrl: string;
  now?: Date;
}

type FeedTime = { allDay: true; start: string; end: string } | { allDay: false; start: Date; end: Date };

interface FeedEvent {
  uid: string;
  time: FeedTime;
  summary: string;
  location: string | null;
  description: string;
  url: string;
  lastModified: Date;
}

export function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = utf8.encode(char).length;
    const limit = chunks.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      chunks.push(current);
      current = char;
      octets = size;
    } else {
      current += char;
      octets += size;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

function toIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function zonedIsoToUtc(isoDate: string, time: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const { hours, minutes } = parseTimeParts(time);
  return zonedTimeToUtc({ year, month, day, hour: hours, minute: minutes }, getAppTimeZone());
}

function htmlToPlainText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|blockquote)>/gi, "\n");
  return getEventDescriptionPreview(withBreaks, CALENDAR_FEED_MAX_DESCRIPTION_CHARS);
}

function terminToFeedEvent(termin: FeedTermin, host: string, baseUrl: string): FeedEvent {
  const start = zonedIsoToUtc(termin.date, termin.timeFrom);
  const end = termin.timeTo && isTimeRangeValid(termin.timeFrom, termin.timeTo)
    ? zonedIsoToUtc(termin.date, termin.timeTo)
    : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    uid: `termin-${termin.id}@${host}`,
    time: { allDay: false, start, end },
    summary: getTerminTitle(termin),
    location: termin.location,
    description: htmlToPlainText(termin.description),
    url: `${baseUrl}/termine/${termin.id}`,
    lastModified: termin.updatedAt,
  };
}

function getFremdterminSummary({ title, kind }: FeedFremdtermin): string {
  if (!kind || kind === ExternalEventKind.OTHER) return title;
  const label = EXTERNAL_EVENT_KIND_LABELS[kind];
  return title.toLowerCase().startsWith(label.toLowerCase()) ? title : `${label}: ${title}`;
}

function fremdterminToFeedEvent(fremdtermin: FeedFremdtermin, host: string, baseUrl: string): FeedEvent {
  const { startDate, endDate, timeFrom, timeTo } = fremdtermin;
  const time: FeedTime =
    fremdtermin.allDay || !timeFrom || !timeTo
      ? { allDay: true, start: toIcsDate(startDate), end: toIcsDate(addDaysToIsoDate(endDate, 1)) }
      : { allDay: false, start: zonedIsoToUtc(startDate, timeFrom), end: zonedIsoToUtc(endDate, timeTo) };
  return {
    uid: `fremdtermin-${fremdtermin.id}@${host}`,
    time,
    summary: getFremdterminSummary(fremdtermin),
    location: fremdtermin.location,
    description: truncateText(fremdtermin.description ?? "", CALENDAR_FEED_MAX_DESCRIPTION_CHARS),
    url: fremdtermin.url && isHttpUrl(fremdtermin.url) ? new URL(fremdtermin.url).href : `${baseUrl}/kalender`,
    lastModified: fremdtermin.updatedAt,
  };
}

function feedEventLines(event: FeedEvent, dtStamp: string): string[] {
  const timeLines = event.time.allDay
    ? [`DTSTART;VALUE=DATE:${event.time.start}`, `DTEND;VALUE=DATE:${event.time.end}`]
    : [`DTSTART:${toIcsDateTimeUtc(event.time.start)}`, `DTEND:${toIcsDateTimeUtc(event.time.end)}`];
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsValue(event.uid)}`,
    `DTSTAMP:${dtStamp}`,
    `LAST-MODIFIED:${toIcsDateTimeUtc(event.lastModified)}`,
    ...timeLines,
    `SUMMARY:${escapeIcsValue(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeIcsValue(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcsValue(event.description)}`] : []),
    `URL:${event.url}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ];
}

export function buildCalendarFeed({ termine, fremdtermine, baseUrl, now = new Date() }: CalendarFeedInput): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const host = new URL(normalizedBaseUrl).host;
  const dtStamp = toIcsDateTimeUtc(now);
  const events = [
    ...termine.map((termin) => terminToFeedEvent(termin, host, normalizedBaseUrl)),
    ...fremdtermine.map((fremdtermin) => fremdterminToFeedEvent(fremdtermin, host, normalizedBaseUrl)),
  ];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${appName}//Kalender//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsValue(`${appName} – Kalender`)}`,
    `X-WR-CALDESC:${escapeIcsValue(`Öffentliche Termine und Fremdtermine der ${appName}`)}`,
    `X-WR-TIMEZONE:${getAppTimeZone()}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${CALENDAR_FEED_REFRESH}`,
    `X-PUBLISHED-TTL:${CALENDAR_FEED_REFRESH}`,
    ...events.flatMap((event) => feedEventLines(event, dtStamp)),
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

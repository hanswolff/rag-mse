import type { CalendarEntry } from "@/lib/calendar-entries";
import { getEventTypeBadgeClasses } from "@/lib/event-types";
import type { Visibility } from "@/lib/visibility";
import { ExternalEventKindBadge } from "@/components/external-event-kind-badge";
import { VisibilityBadge } from "@/components/visibility-badge";

function getEntryVisibility(entry: CalendarEntry): Visibility | undefined {
  if (entry.kind === "termin") return entry.termin.visibility;
  if (entry.kind === "fremdtermin") return entry.fremdtermin.visibility;
  return undefined;
}

function EntryTag({ entry }: { entry: CalendarEntry }) {
  if (entry.kind === "termin" && entry.termin.type) {
    return <span className={`calendar-tag ${getEventTypeBadgeClasses(entry.termin.type)}`}>{entry.termin.type}</span>;
  }
  if (entry.kind === "fremdtermin" && entry.fremdtermin.kind) {
    return <ExternalEventKindBadge kind={entry.fremdtermin.kind} className="calendar-tag" />;
  }
  return null;
}

const KIND_PREFIXES: Partial<Record<CalendarEntry["kind"], string>> = {
  termin: "Termin: ",
  fremdtermin: "Fremdtermin: ",
};

export function CalendarEntryContent({ entry, title, timeText }: { entry: CalendarEntry; title: string; timeText?: string }) {
  const visibility = getEntryVisibility(entry);

  return (
    <span className="calendar-entry-content">
      {timeText && <span className="calendar-entry-time">{timeText}</span>}
      <span className="calendar-entry-title">
        {KIND_PREFIXES[entry.kind] && <span className="sr-only">{KIND_PREFIXES[entry.kind]}</span>}
        {title}
      </span>
      <EntryTag entry={entry} />
      {visibility && <VisibilityBadge visibility={visibility} className="calendar-tag" />}
    </span>
  );
}

"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/modal";
import { VisibilityBadge } from "@/components/visibility-badge";
import { ExternalEventKindBadge } from "@/components/external-event-kind-badge";
import { describeAbsenceOnDay, type CalendarEntry } from "@/lib/calendar-entries";
import type { CalendarAbsence, CalendarFremdtermin } from "@/lib/calendar-service";
import { formatDateUtc, formatPeriod } from "@/lib/dates";

export type DialogEntry = Exclude<CalendarEntry, { kind: "termin" }>;

interface CalendarEntryDialogProps {
  entry: DialogEntry | null;
  onClose: () => void;
  ownAbsenceActions?: (absence: CalendarAbsence) => ReactNode;
  fremdterminActions?: (fremdtermin: CalendarFremdtermin) => ReactNode;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="calendar-detail-row">
      <dt className="calendar-detail-label">{label}</dt>
      <dd className="calendar-detail-value">{children}</dd>
    </div>
  );
}

function FremdterminDetails({ fremdtermin }: { fremdtermin: CalendarFremdtermin }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {fremdtermin.kind && <ExternalEventKindBadge kind={fremdtermin.kind} />}
        {fremdtermin.visibility && <VisibilityBadge visibility={fremdtermin.visibility} />}
      </div>
      <dl className="calendar-detail-list">
        <DetailRow label="Zeitraum">{formatPeriod(fremdtermin)}</DetailRow>
        {fremdtermin.location && <DetailRow label="Ort">{fremdtermin.location}</DetailRow>}
      </dl>
      {fremdtermin.description && <p className="whitespace-pre-line text-gray-800">{fremdtermin.description}</p>}
      {(fremdtermin.ausschreibung || fremdtermin.url) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {fremdtermin.ausschreibung && (
            <a
              href={fremdtermin.ausschreibung.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="document-download-link document-download-link-download"
            >
              <span className="document-download-label">Ausschreibung: {fremdtermin.ausschreibung.title}</span>
            </a>
          )}
          {fremdtermin.url && (
            <a
              href={fremdtermin.url}
              target="_blank"
              rel="noopener noreferrer"
              className="document-download-link document-download-link-external"
            >
              <span className="document-download-label">Weitere Informationen</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function OwnAbsenceDetails({ absence }: { absence: CalendarAbsence }) {
  return (
    <dl className="calendar-detail-list">
      <DetailRow label="Zeitraum">{formatPeriod(absence)}</DetailRow>
      <DetailRow label="Grund">{absence.reason || "Kein Grund angegeben"}</DetailRow>
    </dl>
  );
}

function AbsenceDayList({ date, absences }: { date: string; absences: CalendarAbsence[] }) {
  return (
    <ul className="calendar-absence-list">
      {absences.map((absence) => (
        <li key={absence.id} className="calendar-absence-item">
          <p className="font-semibold text-gray-900">{absence.userName || "Unbekannter Benutzer"}</p>
          <p className="text-gray-700">
            {describeAbsenceOnDay(absence, date)}
            {absence.startDate !== absence.endDate && (
              <span className="text-gray-500"> ({formatPeriod(absence)})</span>
            )}
          </p>
          <p className="text-gray-700">
            <span className="text-gray-500">Grund: </span>
            {absence.reason || "–"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function getDialogTitle(entry: DialogEntry): string {
  if (entry.kind === "fremdtermin") return entry.fremdtermin.title;
  if (entry.kind === "abwesenheit") return "Eigene Abwesenheit";
  return `Abwesend am ${formatDateUtc(entry.date)}`;
}

function getDialogFooter(
  entry: DialogEntry,
  { ownAbsenceActions, fremdterminActions }: Pick<CalendarEntryDialogProps, "ownAbsenceActions" | "fremdterminActions">
): ReactNode {
  if (entry.kind === "abwesenheit") return ownAbsenceActions?.(entry.absence);
  if (entry.kind === "fremdtermin") return fremdterminActions?.(entry.fremdtermin);
  return undefined;
}

export function CalendarEntryDialog({ entry, onClose, ...actions }: CalendarEntryDialogProps) {
  if (!entry) return null;

  const footer = getDialogFooter(entry, actions);

  return (
    <Modal isOpen onClose={onClose} title={getDialogTitle(entry)} size="md" footer={footer}>
      {entry.kind === "fremdtermin" && <FremdterminDetails fremdtermin={entry.fremdtermin} />}
      {entry.kind === "abwesenheit" && <OwnAbsenceDetails absence={entry.absence} />}
      {entry.kind === "abwesenheiten" && <AbsenceDayList date={entry.date} absences={entry.absences} />}
    </Modal>
  );
}

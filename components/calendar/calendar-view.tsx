"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertBox } from "@/components/alert-box";
import { AbsenceFormModal } from "@/components/absence-form-modal";
import { ExternalEventFormModal } from "@/components/external-event-form-modal";
import { LoadingButton } from "@/components/loading-button";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Modal } from "@/components/modal";
import { buildCalendarEvents, DEFAULT_CALENDAR_FILTERS, displayUserName, type CalendarEntry, type CalendarFilters } from "@/lib/calendar-entries";
import type { CalendarAbsence, CalendarFremdtermin, CalendarRange } from "@/lib/calendar-service";
import { buildCalendarSearch, loadCalendarFilters, saveCalendarFilters } from "@/lib/calendar-view-state";
import { formatPeriod } from "@/lib/dates";
import { Permissions } from "@/lib/permissions";
import { useCalendarData } from "@/lib/use-calendar-data";
import { useCalendarEditing } from "@/lib/use-calendar-editing";
import type { AbsenceSource } from "@/lib/use-absence-form";
import type { AbsenceOwnerOption } from "@/types";
import { CalendarEntryDialog, type DialogEntry } from "./calendar-entry-dialog";
import { CalendarSubscribe } from "./calendar-subscribe";
import type { CalendarNavigation } from "./calendar-canvas";

const CalendarCanvas = dynamic(() => import("./calendar-canvas"), {
  ssr: false,
  loading: () => (
    <div className="calendar-placeholder">
      <LoadingIndicator size="md" className="text-gray-400" />
      <span>Kalender wird geladen…</span>
    </div>
  ),
});

const FILTER_OPTIONS: { key: keyof CalendarFilters; label: string; swatch: string; requiresLogin?: boolean }[] = [
  { key: "termine", label: "Termine", swatch: "calendar-swatch-termin" },
  { key: "fremdtermine", label: "Fremdtermine", swatch: "calendar-swatch-fremdtermin" },
  { key: "abwesenheiten", label: "Abwesenheiten", swatch: "calendar-swatch-abwesenheit", requiresLogin: true },
];

function absenceOwnerOf(absence: AbsenceSource | null, self: AbsenceOwnerOption): AbsenceOwnerOption {
  return absence?.userId ? { id: absence.userId, name: absence.userName ?? null } : self;
}

function isSameRange(a: CalendarRange | null, b: CalendarRange) {
  return a?.from === b.from && a?.to === b.to;
}

export function CalendarView() {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const canManageExternalEvents = Permissions.canManageAdminArea(session?.user);
  const canViewCollisions = Permissions.canViewCollisions(session?.user);
  const sessionUserId = session?.user?.id ?? null;
  const absenceManagerId = Permissions.canManageAllAbsences(session?.user) ? sessionUserId ?? undefined : undefined;
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_CALENDAR_FILTERS);
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [dialogEntry, setDialogEntry] = useState<DialogEntry | null>(null);
  const { loaded, isLoading, error, reload } = useCalendarData(range, sessionUserId);
  const editing = useCalendarEditing({
    reload,
    canManageExternalEvents,
    absenceOwnerId: absenceManagerId,
  });
  const { absenceForm, externalEventForm } = editing;

  useEffect(() => {
    setFilters(loadCalendarFilters());
  }, []);

  const toggleFilter = (key: keyof CalendarFilters) => {
    setFilters((current) => {
      const next = { ...current, [key]: !current[key] };
      saveCalendarFilters(next);
      return next;
    });
  };

  const handleNavigate = useCallback(({ range: nextRange, view, date }: CalendarNavigation) => {
    setRange((current) => (isSameRange(current, nextRange) ? current : nextRange));
    const search = `?${buildCalendarSearch(view, date)}`;
    if (window.location.search !== search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}`);
    }
  }, []);

  const handleEntryClick = useCallback(
    (entry: CalendarEntry) => {
      if (entry.kind === "termin") {
        router.push(`/termine/${entry.termin.id}`);
      } else {
        setDialogEntry(entry);
      }
    },
    [router]
  );

  const events = useMemo(
    () => (loaded ? buildCalendarEvents(loaded.data, loaded.range, { ...filters, abwesenheiten: filters.abwesenheiten && isLoggedIn }) : []),
    [loaded, filters, isLoggedIn]
  );

  const collisionDays = useMemo(
    () => new Set(canViewCollisions ? loaded?.data.kollisionen ?? [] : []),
    [loaded, canViewCollisions]
  );

  const closeDialogThen = (action: () => void) => () => {
    setDialogEntry(null);
    action();
  };

  const absenceActions = (absence: CalendarAbsence, inList: boolean) => {
    const label = inList ? `Abwesenheit von ${displayUserName(absence.userName)}, ${formatPeriod(absence)}` : undefined;
    return (
      <div className={inList ? "calendar-absence-actions" : "flex justify-end gap-3"}>
        <button
          type="button"
          className="btn-outline"
          aria-label={label && `${label} löschen`}
          onClick={closeDialogThen(() => editing.deleteAbsence(absence))}
        >
          Löschen
        </button>
        <button
          type="button"
          className="btn-primary"
          aria-label={label && `${label} bearbeiten`}
          onClick={closeDialogThen(() => editing.openAbsenceEdit(absence))}
        >
          Bearbeiten
        </button>
      </div>
    );
  };

  const currentAbsenceOwner = absenceManagerId
    ? absenceOwnerOf(absenceForm.editingAbsence, { id: absenceManagerId, name: session?.user?.name ?? null })
    : undefined;

  const fremdterminActions = (fremdtermin: CalendarFremdtermin) => (
    <div className="flex justify-end">
      <LoadingButton
        type="button"
        className="btn-primary"
        loading={editing.loadingExternalEventId === fremdtermin.id}
        loadingText="Wird geladen…"
        onClick={() => editing.openExternalEventEdit(fremdtermin.id, () => setDialogEntry(null))}
      >
        Bearbeiten
      </LoadingButton>
    </div>
  );

  return (
    <div className="space-y-4">
      {isLoggedIn && (
        <div className="calendar-actions">
          <button type="button" className="btn-primary" onClick={() => editing.openAbsenceCreate()}>
            Abwesenheit eintragen
          </button>
          {canManageExternalEvents && (
            <button type="button" className="btn-outline" onClick={() => editing.openExternalEventCreate()}>
              Fremdtermin eintragen
            </button>
          )}
        </div>
      )}

      <AlertBox type="success" message={editing.success} />
      <AlertBox type="error" message={editing.error} />

      <fieldset className="calendar-filters">
        <legend className="calendar-filters-legend">Anzeigen</legend>
        {FILTER_OPTIONS.filter((option) => !option.requiresLogin || isLoggedIn).map((option) => (
          <label key={option.key} className="calendar-filter">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={filters[option.key]}
              onChange={() => toggleFilter(option.key)}
            />
            <span className={`calendar-swatch ${option.swatch}`} aria-hidden="true" />
            {option.label}
          </label>
        ))}
        {canViewCollisions && (
          <span className="calendar-legend-item">
            <span className="calendar-collision-marker" aria-hidden="true" />
            Kollision
          </span>
        )}
        <span className="calendar-status" role="status" aria-live="polite">
          {isLoading && (
            <>
              <LoadingIndicator className="text-brand-blue-400" />
              Einträge werden geladen…
            </>
          )}
        </span>
      </fieldset>

      {error && (
        <div className="flex flex-wrap items-center gap-3">
          <AlertBox type="error" message={error} className="flex-1" />
          <button type="button" className="btn-outline" onClick={reload}>
            Erneut versuchen
          </button>
        </div>
      )}

      <div className="calendar-shell" aria-busy={isLoading}>
        <CalendarCanvas
          events={events}
          onNavigate={handleNavigate}
          onEntryClick={handleEntryClick}
          onSelect={isLoggedIn ? editing.handleSelect : undefined}
          collisionDays={collisionDays}
        />
      </div>

      <CalendarSubscribe />

      <CalendarEntryDialog
        entry={dialogEntry}
        onClose={() => setDialogEntry(null)}
        ownAbsenceActions={isLoggedIn ? (absence) => absenceActions(absence, false) : undefined}
        foreignAbsenceActions={absenceManagerId ? (absence) => absenceActions(absence, true) : undefined}
        fremdterminActions={canManageExternalEvents ? fremdterminActions : undefined}
      />

      <Modal
        isOpen={editing.pendingSelection !== null}
        onClose={() => editing.chooseSelection(null)}
        title="Was möchten Sie eintragen?"
        size="sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn-primary flex-1" onClick={() => editing.chooseSelection("abwesenheit")}>
            Abwesenheit
          </button>
          <button type="button" className="btn-outline flex-1" onClick={() => editing.chooseSelection("fremdtermin")}>
            Fremdtermin
          </button>
        </div>
      </Modal>

      {isLoggedIn && (
        <AbsenceFormModal
          isOpen={absenceForm.isOpen}
          onClose={absenceForm.close}
          onSubmit={absenceForm.handleSubmit}
          isSubmitting={absenceForm.isSubmitting}
          data={absenceForm.data}
          setData={absenceForm.setData}
          isEditing={!!absenceForm.editingAbsence}
          errors={absenceForm.error ? { general: absenceForm.error } : {}}
          fieldErrors={absenceForm.fieldErrors}
          initialData={absenceForm.initialData}
          currentOwner={currentAbsenceOwner}
          actorId={absenceManagerId}
        />
      )}

      {canManageExternalEvents && (
        <ExternalEventFormModal
          isOpen={externalEventForm.isOpen}
          onClose={externalEventForm.close}
          onSubmit={externalEventForm.handleSubmit}
          isSubmitting={externalEventForm.isSubmitting}
          data={externalEventForm.data}
          setData={externalEventForm.setData}
          isEditing={!!externalEventForm.editingExternalEvent}
          errors={externalEventForm.error ? { general: externalEventForm.error } : {}}
          fieldErrors={externalEventForm.fieldErrors}
          initialData={externalEventForm.initialData}
          currentAusschreibung={externalEventForm.editingExternalEvent?.ausschreibung}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { apiFetch, toDisplayErrorMessage } from "@/lib/api-fetch";
import { API_ROUTES } from "@/lib/api-routes";
import { displayUserName } from "@/lib/calendar-entries";
import type { CalendarAbsence } from "@/lib/calendar-service";
import type { CalendarSelection } from "@/lib/calendar-view-state";
import { useAbsenceForm, type AbsenceSaveMode } from "@/lib/use-absence-form";
import { EXTERNAL_EVENT_SAVED_MESSAGE, useExternalEventForm } from "@/lib/use-external-event-form";
import type { ExternalEventItem } from "@/types";

const ABSENCE_SAVED_MESSAGES: Record<AbsenceSaveMode, string> = {
  created: "Abwesenheit wurde eingetragen.",
  updated: "Abwesenheit wurde aktualisiert.",
};

export const EXTERNAL_EVENT_LOAD_ERROR = "Der Fremdtermin konnte nicht geladen werden. Bitte versuchen Sie es erneut.";

interface CalendarEditingOptions {
  reload: () => void;
  canManageExternalEvents: boolean;
  absenceOwnerId?: string;
}

export function useCalendarEditing({ reload, canManageExternalEvents, absenceOwnerId }: CalendarEditingOptions) {
  const confirm = useConfirmDialog();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [pendingSelection, setPendingSelection] = useState<CalendarSelection | null>(null);
  const [loadingExternalEventId, setLoadingExternalEventId] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    setSuccess("");
    setError("");
  }, []);

  const announce = useCallback((message: string) => {
    setError("");
    setSuccess(message);
    reload();
  }, [reload]);

  const fail = useCallback((message: string) => {
    setSuccess("");
    setError(message);
  }, []);

  const absenceForm = useAbsenceForm(
    useCallback((_, mode) => announce(ABSENCE_SAVED_MESSAGES[mode]), [announce]),
    absenceOwnerId
  );
  const externalEventForm = useExternalEventForm(
    useCallback(() => announce(EXTERNAL_EVENT_SAVED_MESSAGE), [announce])
  );

  const { openCreate: openAbsenceForm, openEdit: openAbsenceEditForm } = absenceForm;
  const { openCreate: openExternalEventForm, openEdit: openExternalEventEditForm } = externalEventForm;

  const openAbsenceCreate = useCallback((defaults?: Partial<CalendarSelection>) => {
    clearFeedback();
    openAbsenceForm(defaults);
  }, [clearFeedback, openAbsenceForm]);

  const openAbsenceEdit = useCallback((absence: CalendarAbsence) => {
    clearFeedback();
    openAbsenceEditForm(absence);
  }, [clearFeedback, openAbsenceEditForm]);

  const openExternalEventCreate = useCallback((defaults?: Partial<CalendarSelection>) => {
    clearFeedback();
    openExternalEventForm(defaults);
  }, [clearFeedback, openExternalEventForm]);

  const openExternalEventEdit = useCallback(async (id: string, onSettled?: () => void) => {
    clearFeedback();
    setLoadingExternalEventId(id);
    try {
      const externalEvent = await apiFetch<ExternalEventItem>(`${API_ROUTES.ADMIN.EXTERNAL_EVENTS}/${id}`, {
        fallbackError: EXTERNAL_EVENT_LOAD_ERROR,
      });
      onSettled?.();
      openExternalEventEditForm(externalEvent);
    } catch (err: unknown) {
      onSettled?.();
      fail(toDisplayErrorMessage(err));
    } finally {
      setLoadingExternalEventId(null);
    }
  }, [clearFeedback, fail, openExternalEventEditForm]);

  const handleSelect = useCallback((selection: CalendarSelection) => {
    if (canManageExternalEvents) {
      clearFeedback();
      setPendingSelection(selection);
    } else {
      openAbsenceCreate(selection);
    }
  }, [canManageExternalEvents, clearFeedback, openAbsenceCreate]);

  const chooseSelection = useCallback((target: "abwesenheit" | "fremdtermin" | null) => {
    if (pendingSelection && target === "abwesenheit") openAbsenceCreate(pendingSelection);
    if (pendingSelection && target === "fremdtermin") openExternalEventCreate(pendingSelection);
    setPendingSelection(null);
  }, [pendingSelection, openAbsenceCreate, openExternalEventCreate]);

  const deleteAbsence = useCallback(async (absence: CalendarAbsence) => {
    clearFeedback();
    const confirmed = await confirm({
      title: "Abwesenheit löschen",
      message: absence.isOwn
        ? "Möchten Sie diese Abwesenheit wirklich löschen?"
        : `Möchten Sie die Abwesenheit von ${displayUserName(absence.userName)} wirklich löschen?`,
      confirmLabel: "Löschen",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await apiFetch(`${API_ROUTES.ABSENCES}/${absence.id}`, { method: "DELETE" });
      announce("Abwesenheit wurde gelöscht.");
    } catch (err: unknown) {
      fail(toDisplayErrorMessage(err));
    }
  }, [clearFeedback, confirm, announce, fail]);

  return {
    success,
    error,
    absenceForm,
    externalEventForm,
    pendingSelection,
    loadingExternalEventId,
    openAbsenceCreate,
    openAbsenceEdit,
    openExternalEventCreate,
    openExternalEventEdit,
    handleSelect,
    chooseSelection,
    deleteAbsence,
  };
}

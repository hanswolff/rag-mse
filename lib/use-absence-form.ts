import { useCallback, useMemo } from "react";
import { API_ROUTES } from "@/lib/api-routes";
import { useEntityForm, type EntitySaveMode } from "@/lib/use-entity-form";
import { EMPTY_ABSENCE_FORM } from "@/types";
import type { AbsenceForm, AbsenceItem } from "@/types";

export type AbsenceSaveMode = EntitySaveMode;

export type AbsenceSource = Pick<AbsenceItem, "id" | "startDate" | "endDate" | "allDay" | "timeFrom" | "timeTo" | "reason"> & {
  userId?: string;
  userName?: string | null;
};

export function absenceToForm(absence: AbsenceSource): AbsenceForm {
  return {
    startDate: absence.startDate,
    endDate: absence.endDate,
    allDay: absence.allDay,
    timeFrom: absence.timeFrom ?? "",
    timeTo: absence.timeTo ?? "",
    reason: absence.reason ?? "",
  };
}

export function emptyAbsenceForm(ownerId?: string): AbsenceForm {
  return ownerId ? { ...EMPTY_ABSENCE_FORM, userId: ownerId } : EMPTY_ABSENCE_FORM;
}

export function useAbsenceForm(
  onSaved: (saved: AbsenceItem, mode: AbsenceSaveMode) => void | Promise<void>,
  defaultOwnerId?: string
) {
  const emptyForm = useMemo(() => emptyAbsenceForm(defaultOwnerId), [defaultOwnerId]);
  const toForm = useCallback(
    (absence: AbsenceSource): AbsenceForm =>
      defaultOwnerId ? { ...absenceToForm(absence), userId: absence.userId ?? defaultOwnerId } : absenceToForm(absence),
    [defaultOwnerId]
  );
  const { editing, ...form } = useEntityForm<AbsenceItem, AbsenceForm, AbsenceSource>({
    endpoint: API_ROUTES.ABSENCES,
    emptyForm,
    toForm,
    onSaved,
  });
  return { ...form, editingAbsence: editing };
}

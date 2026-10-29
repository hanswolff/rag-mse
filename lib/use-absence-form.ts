import { API_ROUTES } from "@/lib/api-routes";
import { useEntityForm, type EntitySaveMode } from "@/lib/use-entity-form";
import { EMPTY_ABSENCE_FORM } from "@/types";
import type { AbsenceForm, AbsenceItem } from "@/types";

export type AbsenceSaveMode = EntitySaveMode;

export type AbsenceSource = Pick<AbsenceItem, "id" | "startDate" | "endDate" | "allDay" | "timeFrom" | "timeTo" | "reason">;

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

export function useAbsenceForm(onSaved: (saved: AbsenceItem, mode: AbsenceSaveMode) => void | Promise<void>) {
  const { editing, ...form } = useEntityForm<AbsenceItem, AbsenceForm, AbsenceSource>({
    endpoint: API_ROUTES.ABSENCES,
    emptyForm: EMPTY_ABSENCE_FORM,
    toForm: absenceToForm,
    onSaved,
  });
  return { ...form, editingAbsence: editing };
}

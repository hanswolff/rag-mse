import { API_ROUTES } from "@/lib/api-routes";
import { useEntityForm, type EntitySaveMode } from "@/lib/use-entity-form";
import { EMPTY_EXTERNAL_EVENT_FORM } from "@/types";
import type { ExternalEventForm, ExternalEventItem } from "@/types";

export type ExternalEventSaveMode = EntitySaveMode;

export const EXTERNAL_EVENT_SAVED_MESSAGE = "Fremdtermin wurde gespeichert.";
export const EXTERNAL_EVENT_DELETED_MESSAGE = "Fremdtermin wurde gelöscht.";

export function externalEventToForm(externalEvent: ExternalEventItem): ExternalEventForm {
  return {
    title: externalEvent.title,
    startDate: externalEvent.startDate,
    endDate: externalEvent.endDate,
    allDay: externalEvent.allDay,
    timeFrom: externalEvent.timeFrom ?? "",
    timeTo: externalEvent.timeTo ?? "",
    location: externalEvent.location ?? "",
    description: externalEvent.description ?? "",
    url: externalEvent.url ?? "",
    kind: externalEvent.kind ?? "",
    visibility: externalEvent.visibility,
    ausschreibungId: externalEvent.ausschreibungId ?? "",
  };
}

export function useExternalEventForm(onSaved: (saved: ExternalEventItem, mode: ExternalEventSaveMode) => void | Promise<void>) {
  const { editing, ...form } = useEntityForm({
    endpoint: API_ROUTES.ADMIN.EXTERNAL_EVENTS,
    emptyForm: EMPTY_EXTERNAL_EVENT_FORM,
    toForm: externalEventToForm,
    onSaved,
  });
  return { ...form, editingExternalEvent: editing };
}

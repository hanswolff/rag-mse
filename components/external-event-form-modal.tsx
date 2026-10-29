"use client";

import { useEffect, useState } from "react";
import { FormModal } from "./form-modal";
import { PeriodFields } from "./period-fields";
import { ValidatedFieldGroup } from "./validated-field-group";
import { VisibilitySelect } from "./visibility-select";
import { usePeriodFields } from "@/lib/use-period-fields";
import { EXTERNAL_EVENT_FIELD_KEYWORDS } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";
import {
  externalEventFormSchema,
  externalEventValidationConfig,
  MAX_EVENT_TITLE_LENGTH,
  MAX_EXTERNAL_EVENT_DESCRIPTION_LENGTH,
  MAX_EXTERNAL_EVENT_LOCATION_LENGTH,
  MAX_EXTERNAL_EVENT_URL_LENGTH,
} from "@/lib/validation-schema";
import { EXTERNAL_EVENT_KINDS, EXTERNAL_EVENT_KIND_LABELS } from "@/lib/external-event-kind";
import { API_ROUTES } from "@/lib/api-routes";
import { apiFetch } from "@/lib/api-fetch";
import { getGermanDateString } from "@/lib/date-picker-utils";
import { EMPTY_EXTERNAL_EVENT_FORM } from "@/types";
import type { AusschreibungItem, ExternalEventForm } from "@/types";

interface ExternalEventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  data: ExternalEventForm;
  setData: (data: ExternalEventForm) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  fieldErrors?: FieldError[];
  initialData?: ExternalEventForm;
  currentAusschreibung?: AusschreibungOption | null;
}

type AusschreibungOption = { id: string; title: string };
type AusschreibungLoad = { status: "loading" | "error" | "ready"; items: AusschreibungItem[] };

function useAusschreibungOptions(isOpen: boolean, current: AusschreibungOption | null) {
  const [load, setLoad] = useState<AusschreibungLoad>({ status: "loading", items: [] });
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setLoad({ status: "loading", items: [] });
  }

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiFetch<{ ausschreibungen: AusschreibungItem[] }>(API_ROUTES.ADMIN.AUSSCHREIBUNGEN)
      .then((result) => {
        if (active) setLoad({ status: "ready", items: result.ausschreibungen ?? [] });
      })
      .catch(() => {
        if (active) setLoad({ status: "error", items: [] });
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const today = getGermanDateString();
  const options = load.items.map((ausschreibung) => ({
    id: ausschreibung.id,
    label:
      ausschreibung.expiresAt.slice(0, 10) < today
        ? `${ausschreibung.title} (abgelaufen)`
        : ausschreibung.title,
  }));
  if (current && !options.some((option) => option.id === current.id)) {
    options.unshift({ id: current.id, label: current.title });
  }
  return { status: load.status, options };
}

export function ExternalEventFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  data,
  setData,
  isEditing,
  errors = {},
  fieldErrors,
  initialData,
  currentAusschreibung = null,
}: ExternalEventFormModalProps) {
  const ausschreibungen = useAusschreibungOptions(isOpen, currentAusschreibung);
  const period = usePeriodFields(externalEventFormSchema, data, setData, isOpen);

  return (
    <FormModal<ExternalEventForm>
      validationConfig={externalEventValidationConfig}
      formData={data}
      setFormData={setData}
      defaultData={EMPTY_EXTERNAL_EVENT_FORM}
      initialData={initialData}
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      serverErrors={errors}
      fieldErrors={fieldErrors}
      fieldKeywords={EXTERNAL_EVENT_FIELD_KEYWORDS}
      extraValidation={period.validatePeriod}
      title={isEditing ? "Fremdtermin bearbeiten" : "Neuen Fremdtermin erstellen"}
      size="2xl"
      submitLabel={isEditing ? "Aktualisieren" : "Erstellen"}
    >
      {({ getFieldError, handleChange, handleBlur }) => (
        <>
          <ValidatedFieldGroup
            label="Titel"
            name="title"
            id="external-event-title"
            type="text"
            value={data.title}
            onChange={(e) => handleChange("title", e.target.value)}
            onBlur={(e) => handleBlur("title", e.target.value)}
            error={getFieldError("title")}
            required
            maxLength={MAX_EVENT_TITLE_LENGTH}
            placeholder="z. B. RDL Schießausbildung"
            disabled={isSubmitting}
            autoFocus={!isEditing}
          />

          <PeriodFields
            idPrefix="external-event"
            data={data}
            period={period}
            disabled={isSubmitting}
            getFieldError={getFieldError}
            handleChange={handleChange}
            handleBlur={handleBlur}
          />

          <ValidatedFieldGroup
            label="Ort"
            name="location"
            id="external-event-location"
            type="text"
            value={data.location}
            onChange={(e) => handleChange("location", e.target.value)}
            onBlur={(e) => handleBlur("location", e.target.value)}
            error={getFieldError("location")}
            maxLength={MAX_EXTERNAL_EVENT_LOCATION_LENGTH}
            placeholder="z. B. Truppenübungsplatz Lehnin"
            disabled={isSubmitting}
          />

          <ValidatedFieldGroup
            as="textarea"
            label="Beschreibung"
            name="description"
            id="external-event-description"
            value={data.description}
            onChange={(e) => handleChange("description", e.target.value)}
            onBlur={(e) => handleBlur("description", e.target.value)}
            error={getFieldError("description")}
            maxLength={MAX_EXTERNAL_EVENT_DESCRIPTION_LENGTH}
            rows={3}
            disabled={isSubmitting}
          />

          <ValidatedFieldGroup
            label="Link (Weitere Informationen)"
            name="url"
            id="external-event-url"
            type="url"
            value={data.url}
            onChange={(e) => handleChange("url", e.target.value)}
            onBlur={(e) => handleBlur("url", e.target.value)}
            error={getFieldError("url")}
            maxLength={MAX_EXTERNAL_EVENT_URL_LENGTH}
            placeholder="https://"
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="external-event-kind" className="form-label">Art</label>
              <select
                id="external-event-kind"
                className="form-select"
                value={data.kind}
                onChange={(e) => handleChange("kind", e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Keine Art</option>
                {EXTERNAL_EVENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {EXTERNAL_EVENT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>

            <VisibilitySelect
              id="external-event-visibility"
              value={data.visibility}
              onChange={(visibility) => handleChange("visibility", visibility)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="external-event-ausschreibung" className="form-label">Ausschreibung</label>
            <select
              id="external-event-ausschreibung"
              className="form-select"
              value={data.ausschreibungId}
              onChange={(e) => handleChange("ausschreibungId", e.target.value)}
              disabled={isSubmitting || ausschreibungen.status === "loading"}
              aria-busy={ausschreibungen.status === "loading"}
            >
              <option value="">Keine Ausschreibung</option>
              {ausschreibungen.options.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            {ausschreibungen.status === "loading" && (
              <p className="form-help">Ausschreibungen werden geladen…</p>
            )}
            {ausschreibungen.status === "error" && (
              <p className="form-help text-red-600">
                Ausschreibungen konnten nicht geladen werden. Die bisherige Auswahl bleibt erhalten.
              </p>
            )}
            {getFieldError("ausschreibungId") && (
              <p className="form-help text-red-600">{getFieldError("ausschreibungId")}</p>
            )}
          </div>
        </>
      )}
    </FormModal>
  );
}

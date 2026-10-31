"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FormModal } from "./form-modal";
import { PeriodFields } from "./period-fields";
import { ValidatedFieldGroup } from "./validated-field-group";
import { usePeriodFields } from "@/lib/use-period-fields";
import { ABSENCE_FIELD_KEYWORDS, ABSENCE_WITH_OWNER_FIELD_KEYWORDS, type FieldError } from "@/lib/server-error-mapper";
import { apiFetch } from "@/lib/api-fetch";
import { API_ROUTES } from "@/lib/api-routes";
import { displayUserName } from "@/lib/calendar-entries";
import { absenceFormSchema, absenceValidationConfig, MAX_ABSENCE_REASON_LENGTH } from "@/lib/validation-schema";
import { emptyAbsenceForm } from "@/lib/use-absence-form";
import type { AbsenceForm, AbsenceOwnerOption } from "@/types";

export const ABSENCE_REASON_HINT =
  "Bitte keine Gesundheits- oder sonstigen sensiblen Angaben – „Urlaub“ oder „verhindert“ genügt.";
const OWN_VISIBILITY_HINT = "Sichtbar für Sie sowie Administratoren und Prüfer.";
const FOREIGN_VISIBILITY_HINT = "Sichtbar für den Benutzer sowie Administratoren und Prüfer.";
const OWNER_LOAD_HINTS: Record<OwnerLoad["status"], string | undefined> = {
  loading: "Benutzer werden geladen…",
  error: "Benutzer konnten nicht geladen werden. Die bisherige Auswahl bleibt erhalten.",
  ready: undefined,
};

interface AbsenceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  data: AbsenceForm;
  setData: (data: AbsenceForm) => void;
  isEditing: boolean;
  errors?: Record<string, string>;
  fieldErrors?: FieldError[];
  initialData?: AbsenceForm;
  currentOwner?: AbsenceOwnerOption;
  actorId?: string;
}

type OwnerLoad = { status: "loading" | "error" | "ready"; users: AbsenceOwnerOption[] };

function useAbsenceOwnerOptions(isOpen: boolean, current: AbsenceOwnerOption | undefined) {
  const enabled = isOpen && current !== undefined;
  const [load, setLoad] = useState<OwnerLoad>({ status: "loading", users: [] });
  const [attempt, setAttempt] = useState(0);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) setLoad({ status: "loading", users: [] });
  }

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    apiFetch<{ users: AbsenceOwnerOption[] }>(API_ROUTES.ABSENCE_OWNERS)
      .then((result) => {
        if (active) setLoad({ status: "ready", users: result.users ?? [] });
      })
      .catch(() => {
        if (active) setLoad({ status: "error", users: [] });
      });
    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: "loading", users: [] });
    setAttempt((current) => current + 1);
  }, []);

  const options =
    current && !load.users.some((user) => user.id === current.id) ? [current, ...load.users] : load.users;
  return { status: load.status, options, retry };
}

export function AbsenceFormModal({
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
  currentOwner,
  actorId,
}: AbsenceFormModalProps) {
  const period = usePeriodFields(absenceFormSchema, data, setData, isOpen);
  const owners = useAbsenceOwnerOptions(isOpen, currentOwner);
  const currentOwnerId = currentOwner?.id;
  const defaultData = useMemo(() => emptyAbsenceForm(currentOwnerId), [currentOwnerId]);
  const selectedOwnerId = data.userId ?? currentOwnerId;
  const forOtherUser = actorId !== undefined && selectedOwnerId !== undefined && selectedOwnerId !== actorId;

  return (
    <FormModal<AbsenceForm>
      validationConfig={absenceValidationConfig}
      formData={data}
      setFormData={setData}
      defaultData={defaultData}
      initialData={initialData}
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      serverErrors={errors}
      fieldErrors={fieldErrors}
      fieldKeywords={currentOwner ? ABSENCE_WITH_OWNER_FIELD_KEYWORDS : ABSENCE_FIELD_KEYWORDS}
      extraValidation={period.validatePeriod}
      title={isEditing ? "Abwesenheit bearbeiten" : "Abwesenheit eintragen"}
      size="lg"
      submitLabel={isEditing ? "Aktualisieren" : "Eintragen"}
    >
      {({ getFieldError, handleChange, handleBlur }) => (
        <>
          {currentOwner && (
            <OwnerSelect
              value={data.userId ?? currentOwner.id}
              owners={owners}
              error={getFieldError("userId")}
              disabled={isSubmitting}
              onChange={(userId) => handleChange("userId", userId)}
            />
          )}

          <PeriodFields
            idPrefix="absence"
            data={data}
            period={period}
            disabled={isSubmitting}
            getFieldError={getFieldError}
            handleChange={handleChange}
            handleBlur={handleBlur}
          />

          <ValidatedFieldGroup
            label="Grund"
            name="reason"
            id="absence-reason"
            type="text"
            value={data.reason}
            onChange={(e) => handleChange("reason", e.target.value)}
            onBlur={(e) => handleBlur("reason", e.target.value)}
            error={getFieldError("reason")}
            hint={ABSENCE_REASON_HINT}
            helpText={`${data.reason.length} / ${MAX_ABSENCE_REASON_LENGTH} Zeichen`}
            maxLength={MAX_ABSENCE_REASON_LENGTH}
            placeholder="z. B. Urlaub"
            disabled={isSubmitting}
          />
          <p className="form-help">{forOtherUser ? FOREIGN_VISIBILITY_HINT : OWN_VISIBILITY_HINT}</p>
        </>
      )}
    </FormModal>
  );
}

interface OwnerSelectProps {
  value: string;
  owners: ReturnType<typeof useAbsenceOwnerOptions>;
  error?: string;
  disabled: boolean;
  onChange: (userId: string) => void;
}

function OwnerSelect({ value, owners, error, disabled, onChange }: OwnerSelectProps) {
  const id = "absence-user";
  const hint = OWNER_LOAD_HINTS[owners.status];
  const describedBy = error ? `${id}-error` : hint && `${id}-help`;
  return (
    <div>
      <label htmlFor={id} className="form-label">Benutzer</label>
      <select
        id={id}
        className={`form-select ${error ? "border-red-500 focus:border-red-500" : ""}`.trim()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      >
        {owners.options.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {displayUserName(owner.name)}
          </option>
        ))}
      </select>
      {error && <p id={`${id}-error`} className="form-help text-red-600" role="alert">{error}</p>}
      <p id={`${id}-help`} className="form-help" role="status">{hint}</p>
      {owners.status === "error" && (
        <button type="button" className="btn-outline mt-2" onClick={owners.retry} disabled={disabled}>
          Erneut laden
        </button>
      )}
    </div>
  );
}

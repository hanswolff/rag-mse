"use client";

import { FormModal } from "./form-modal";
import { PeriodFields } from "./period-fields";
import { ValidatedFieldGroup } from "./validated-field-group";
import { usePeriodFields } from "@/lib/use-period-fields";
import { ABSENCE_FIELD_KEYWORDS, type FieldError } from "@/lib/server-error-mapper";
import { absenceFormSchema, absenceValidationConfig, MAX_ABSENCE_REASON_LENGTH } from "@/lib/validation-schema";
import { EMPTY_ABSENCE_FORM } from "@/types";
import type { AbsenceForm } from "@/types";

export const ABSENCE_REASON_HINT =
  "Bitte keine Gesundheits- oder sonstigen sensiblen Angaben – „Urlaub“ oder „verhindert“ genügt.";
export const ABSENCE_VISIBILITY_HINT = "Sichtbar für Sie sowie Administratoren und Prüfer.";

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
}: AbsenceFormModalProps) {
  const period = usePeriodFields(absenceFormSchema, data, setData, isOpen);

  return (
    <FormModal<AbsenceForm>
      validationConfig={absenceValidationConfig}
      formData={data}
      setFormData={setData}
      defaultData={EMPTY_ABSENCE_FORM}
      initialData={initialData}
      isOpen={isOpen}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      serverErrors={errors}
      fieldErrors={fieldErrors}
      fieldKeywords={ABSENCE_FIELD_KEYWORDS}
      extraValidation={period.validatePeriod}
      title={isEditing ? "Abwesenheit bearbeiten" : "Abwesenheit eintragen"}
      size="lg"
      submitLabel={isEditing ? "Aktualisieren" : "Eintragen"}
    >
      {({ getFieldError, handleChange, handleBlur }) => (
        <>
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
          <p className="form-help">{ABSENCE_VISIBILITY_HINT}</p>
        </>
      )}
    </FormModal>
  );
}

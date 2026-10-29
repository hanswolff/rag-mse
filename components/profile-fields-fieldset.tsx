"use client";

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { GermanDatePicker } from "@/components/german-date-picker";
import { ValidatedFieldGroup } from "@/components/validated-field-group";
import { useFormFieldValidation } from "@/lib/use-form-field-validation";
import { profileValidationConfig } from "@/lib/validation-schema";

export interface ProfileFieldsFormData {
  name: string;
  address: string;
  phone: string;
  dateOfBirth: string;
  rank: string;
  pk: string;
  reservistsAssociation: string;
  associationMemberNumber: string;
  hasPossessionCard: boolean;
}

export type ProfileTextField = Exclude<keyof ProfileFieldsFormData, "hasPossessionCard">;

export function useProfileFormFields<T extends ProfileFieldsFormData>(
  formData: T,
  setFormData: Dispatch<SetStateAction<T>>
) {
  const {
    errors: validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
  } = useFormFieldValidation(profileValidationConfig);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const setFieldValue = (fieldName: ProfileTextField, value: string) => {
    setFormData((current) => ({ ...current, [fieldName]: value }));
    setServerFieldErrors((prev) => ({ ...prev, [fieldName]: "" }));

    if (validationErrors[fieldName]) {
      validateField(fieldName, value);
    }
  };

  const handleFieldBlur = (fieldName: ProfileTextField, value: string) => {
    markFieldAsTouched(fieldName);
    validateField(fieldName, value);
  };

  const getFieldError = (fieldName: ProfileTextField): string | undefined => {
    if (serverFieldErrors[fieldName]) return serverFieldErrors[fieldName];
    return shouldShowError(fieldName, formData[fieldName])
      ? validationErrors[fieldName]
      : undefined;
  };

  const isFieldValidAndTouched = (fieldName: ProfileTextField): boolean =>
    isValidAndTouched(fieldName, formData[fieldName]);

  return {
    serverFieldErrors,
    setServerFieldErrors,
    setFieldValue,
    handleFieldBlur,
    getFieldError,
    isFieldValidAndTouched,
    validateAllFields,
  };
}

interface ProfileFieldsFieldsetProps {
  formData: ProfileFieldsFormData;
  disabled: boolean;
  onFieldChange: (fieldName: ProfileTextField, value: string) => void;
  onFieldBlur: (fieldName: ProfileTextField, value: string) => void;
  onHasPossessionCardChange: (checked: boolean) => void;
  getFieldError: (fieldName: ProfileTextField) => string | undefined;
  isValidAndTouched: (fieldName: ProfileTextField) => boolean;
  emailSlot?: ReactNode;
}

export function ProfileFieldsFieldset({
  formData,
  disabled,
  onFieldChange,
  onFieldBlur,
  onHasPossessionCardChange,
  getFieldError,
  isValidAndTouched,
  emailSlot,
}: ProfileFieldsFieldsetProps) {
  const textFieldProps = (fieldName: ProfileTextField) => ({
    name: fieldName,
    value: formData[fieldName],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onFieldChange(fieldName, e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onFieldBlur(fieldName, e.target.value),
    error: getFieldError(fieldName),
    showSuccess: isValidAndTouched(fieldName),
    disabled,
  });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ValidatedFieldGroup
          label="Name"
          type="text"
          {...textFieldProps("name")}
          required
          maxLength={100}
          placeholder="Max Mustermann"
          autoFocus
        />

        <GermanDatePicker
          id="dateOfBirth"
          label="Geburtsdatum"
          value={formData.dateOfBirth}
          onChange={(date) => onFieldChange("dateOfBirth", date)}
          onBlur={() => onFieldBlur("dateOfBirth", formData.dateOfBirth)}
          disabled={disabled}
          error={getFieldError("dateOfBirth")}
          showSuccess={isValidAndTouched("dateOfBirth")}
        />
      </div>

      <ValidatedFieldGroup
        as="textarea"
        label="Adresse"
        {...textFieldProps("address")}
        rows={3}
        maxLength={200}
        placeholder="Musterstraße 1&#10;12345 Musterstadt"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {emailSlot}

        <ValidatedFieldGroup
          label="Telefon"
          type="tel"
          {...textFieldProps("phone")}
          maxLength={30}
          placeholder="+49 123 456789"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ValidatedFieldGroup
          label="Dienstgrad"
          type="text"
          {...textFieldProps("rank")}
          maxLength={30}
          placeholder="z. B. Obergefreiter d.R."
        />

        <ValidatedFieldGroup
          label="PK"
          type="text"
          {...textFieldProps("pk")}
          maxLength={20}
          placeholder="z. B. 12345 A 67890"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ValidatedFieldGroup
          label="Reservistenkameradschaft"
          type="text"
          {...textFieldProps("reservistsAssociation")}
          maxLength={30}
          placeholder="z. B. RK MSE"
        />

        <ValidatedFieldGroup
          label="Mitgliedsnummer im Verband"
          type="text"
          {...textFieldProps("associationMemberNumber")}
          maxLength={30}
          placeholder="z. B. 1234567890"
        />
      </div>

      <div>
        <p className="form-label">Waffenbesitzkarte</p>
        <div className="flex items-center gap-3">
          <input
            id="hasPossessionCard"
            name="hasPossessionCard"
            type="checkbox"
            checked={formData.hasPossessionCard}
            onChange={(e) => onHasPossessionCardChange(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            disabled={disabled}
          />
          <label htmlFor="hasPossessionCard" className="text-gray-700 cursor-pointer">
            Ich besitze eine eigene Waffenbesitzkarte
          </label>
        </div>
      </div>
    </>
  );
}
